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

const PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;

const MIN_SALT_LENGTH = 8;
const MIN_KEY_LENGTH = 32;

type StoredHash = { params: ScryptParams; salt: Buffer; expected: Buffer };

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
			{ N, r, p, maxmem: 256 * N * r },
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

	const salt = Buffer.from(rawSalt, 'base64');
	const expected = Buffer.from(rawKey, 'base64');
	if (salt.length < MIN_SALT_LENGTH || expected.length < MIN_KEY_LENGTH) {
		return undefined;
	}

	return { params, salt, expected };
}

function formatStored(salt: Buffer, key: Buffer): string {
	const { N, r, p } = PARAMS;

	return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);

	return formatStored(salt, await deriveKey(password, salt, KEY_LENGTH, PARAMS));
}

export function decoyHash(): string {
	return formatStored(randomBytes(SALT_LENGTH), randomBytes(KEY_LENGTH));
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | undefined {
	if (password.normalize('NFKC').length < MIN_PASSWORD_LENGTH) {
		return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
	}

	return undefined;
}

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
