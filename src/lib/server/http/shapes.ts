import { currentPasswordRequired } from '../auth/accounts.ts';

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

export type PublicUser = {
	id: string;
	email: string;
	createdAt: number;
	hasPassword: boolean;
	currentPasswordRequired: boolean;
};

/**
 * `hasPassword` names the button — setting a first one and replacing one are
 * the same request and different sentences. `currentPasswordRequired` names the
 * field, and is `currentPasswordRequired()`'s answer rather than the two facts
 * it reads, so the form cannot come to its own conclusion about a rule the
 * endpoint enforces. Neither says anything about Google that the account's own
 * sign-in screen did not already.
 */
export function publicUser(user: User): PublicUser {
	return {
		id: user.id,
		email: user.email,
		createdAt: user.createdAt.getTime(),
		hasPassword: user.passwordHash !== null,
		currentPasswordRequired: currentPasswordRequired(user)
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
