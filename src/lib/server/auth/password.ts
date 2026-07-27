import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Passwords are hashed with scrypt from `node:crypto` — memory-hard, on
 * OWASP's approved list, and built into the platform, so the container stays
 * free of compiled dependencies for the same reason `node:sqlite` was chosen
 * over better-sqlite3.
 *
 * Asynchronous, unlike the rest of this layer, and deliberately so: a single
 * hash costs ~370 ms and ~128 MB, `adapter-node` is one process that also
 * serves the SPA, and `scryptSync` would hold the event loop for the whole of
 * it — a handful of parallel login attempts would be a denial of service.
 * `crypto.scrypt` does the same work on the libuv threadpool. (`DatabaseSync`
 * next door is sync because SQLite offers nothing else; this had a choice.)
 */

type ScryptParams = { N: number; r: number; p: number };

/** OWASP's minimum for scrypt. Raise `N` first when hardware moves on. */
const PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Bounds on the parameters read back out of a *stored* hash. They travel in
 * the string, so a corrupted or tampered row is attacker-controlled input to a
 * memory-hard function: `N` of 2**24 asks for gigabytes before failing, and
 * scrypt throws — rather than returns false — for an `N` that is not a power
 * of two. Anything outside these bounds is a hash that cannot verify.
 */
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;

/**
 * Floors, not equalities: a stored hash carries its salt and key lengths only
 * implicitly, so raising `KEY_LENGTH` later must not stop old hashes from
 * verifying. What a floor does stop is the truncated row — `Buffer.from('',
 * 'base64')` is zero bytes, and a zero-byte comparison succeeds against every
 * password on earth.
 */
const MIN_SALT_LENGTH = 8;
const MIN_KEY_LENGTH = 32;

type StoredHash = { params: ScryptParams; salt: Buffer; expected: Buffer };

/** `128 * N * r` bytes, plus headroom — Node's 32 MB default is far too low. */
function maxmemFor({ N, r }: ScryptParams): number {
	return 256 * N * r;
}

async function deriveKey(
	password: string,
	salt: Buffer,
	keyLength: number,
	params: ScryptParams
): Promise<Buffer> {
	const { N, r, p } = params;

	// The one hand-rolled promise in the codebase, and it earns its exception:
	// `crypto.scrypt` is a Node callback API, and `promisify` resolves it to the
	// wrong overload — `unknown`, three parameters — which would cost a type
	// assertion to undo. A callback wrapped once, here, is the smaller lie.
	// oxlint-disable-next-line promise/avoid-new
	const key = await new Promise<Buffer>((resolve, reject) => {
		scrypt(
			password.normalize('NFKC'),
			salt,
			keyLength,
			{ N, r, p, maxmem: maxmemFor(params) },
			(error, derived) => {
				if (error) {
					reject(error);
				} else {
					resolve(derived);
				}
			}
		);
	});

	return key;
}

function parseParams(rawN: string, rawR: string, rawP: string): ScryptParams | undefined {
	const N = Number(rawN);
	const r = Number(rawR);
	const p = Number(rawP);

	// `2 ** Math.round(Math.log2(N))` rather than a bitwise test: the bitwise
	// operators are off across this repo, and the round-trip is exact for every
	// power of two in range.
	if (!Number.isInteger(N) || N < 2 || N > MAX_N || 2 ** Math.round(Math.log2(N)) !== N) {
		return undefined;
	}
	if (!Number.isInteger(r) || r < 1 || r > MAX_R) {
		return undefined;
	}
	if (!Number.isInteger(p) || p < 1 || p > MAX_P) {
		return undefined;
	}

	return { N, r, p };
}

function parseStored(stored: string): StoredHash | undefined {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') {
		return undefined;
	}

	const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
	const params = parseParams(rawN, rawR, rawP);
	if (params === undefined) {
		return undefined;
	}

	// `Buffer.from` never throws on base64: it discards what it cannot decode
	// and returns what is left, so the lengths are the only real check.
	const salt = Buffer.from(rawSalt, 'base64');
	const expected = Buffer.from(rawKey, 'base64');
	if (salt.length < MIN_SALT_LENGTH || expected.length < MIN_KEY_LENGTH) {
		return undefined;
	}

	return { params, salt, expected };
}

/**
 * Returns a self-describing hash: `scrypt$N$r$p$salt$key`, all base64. The
 * parameters travel with the hash, so raising the cost factor later is a
 * write-on-next-login change and never a migration — old hashes keep verifying
 * against the parameters they were made with.
 */
export async function hashPassword(password: string): Promise<string> {
	const { N, r, p } = PARAMS;
	const salt = randomBytes(SALT_LENGTH);
	const key = await deriveKey(password, salt, KEY_LENGTH, PARAMS);

	return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Constant-time verification. Every malformed, truncated or unknown-scheme
 * hash returns false; none of them throws, because the caller is a login route
 * that owes the client a 401 rather than a 500.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parsed = parseStored(stored);
	if (parsed === undefined) {
		return false;
	}

	const { params, salt, expected } = parsed;
	// The key length comes from the stored hash, so the two buffers match by
	// construction — which is what `timingSafeEqual` requires, and why the
	// length is bounded above rather than trusted.
	const actual = await deriveKey(password, salt, expected.length, params);

	return timingSafeEqual(actual, expected);
}
