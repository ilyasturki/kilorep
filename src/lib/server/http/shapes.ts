import type { AuthToken, User } from '../db/schema.ts';

export type PublicToken = {
	id: string;
	label: string;
	kind: AuthToken['kind'];
	prefix: string;
	createdAt: number;
	lastUsedAt: number | null;
	expiresAt: number | null;
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
