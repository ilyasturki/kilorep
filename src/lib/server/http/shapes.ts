import type { AuthToken, User } from '../db/schema.ts';

/**
 * What an account and a credential look like on the wire.
 *
 * Every response builds its payload through here, by construction rather than
 * by review: `passwordHash` and `tokenHash` exist on the rows and must never
 * leave the process, and the reliable way to guarantee that is for no endpoint
 * to serialise a row directly.
 *
 * Timestamps go out as epoch milliseconds, matching the schema's own
 * convention — a number needs no parsing and carries no timezone to disagree
 * about.
 */

export type PublicToken = {
	id: string;
	label: string;
	kind: AuthToken['kind'];
	prefix: string;
	createdAt: number;
	lastUsedAt: number | null;
	expiresAt: number | null;
	/** Whether this is the credential the request itself arrived with. */
	current: boolean;
};

function epoch(value: Date | null): number | null {
	return value === null ? null : value.getTime();
}

export function publicUser(user: User): { id: string; email: string; createdAt: number } {
	return {
		id: user.id,
		email: user.email,
		createdAt: user.createdAt.getTime()
	};
}

export function publicToken(token: AuthToken, current: boolean): PublicToken {
	return {
		id: token.id,
		label: token.label,
		kind: token.kind,
		prefix: token.tokenPrefix,
		createdAt: token.createdAt.getTime(),
		lastUsedAt: epoch(token.lastUsedAt),
		expiresAt: epoch(token.expiresAt),
		current
	};
}
