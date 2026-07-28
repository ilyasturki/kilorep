import { createHash, randomBytes } from 'node:crypto';

/**
 * One credential type for every client: the browser stores it in an HttpOnly
 * cookie, the APK and MCP send it as a Bearer header. The server never keeps
 * the cleartext — only a SHA-256 hash — so a database leak yields nothing
 * usable and revocation is a row delete.
 *
 * SHA-256 rather than a password KDF is correct here and only here: the secret
 * is 256 bits of CSPRNG output, so there is no guessable input to slow down,
 * and every authenticated request pays this cost.
 */

const PREFIX = 'kr_';
const SECRET_BYTES = 32;

/** Enough of the cleartext to identify a row in a token list. */
const PREFIX_LENGTH = PREFIX.length + 8;

export type MintedToken = {
	/** Shown to the user exactly once. Never stored, never logged. */
	token: string;
	tokenHash: string;
	tokenPrefix: string;
};

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function mintToken(): MintedToken {
	const token = PREFIX + randomBytes(SECRET_BYTES).toString('base64url');

	return {
		token,
		tokenHash: hashToken(token),
		tokenPrefix: token.slice(0, PREFIX_LENGTH)
	};
}
