// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Credential } from '$lib/server/auth/session';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/**
			 * The account behind the request and the credential it arrived with,
			 * resolved in `hooks.server.ts`.
			 *
			 * Null on every non-`/api` request, whether or not the caller holds a
			 * valid credential: pages are client-rendered, so nothing reads this,
			 * and resolving it would cost a query per asset. Endpoints should reach
			 * it through `requireCredential`, which narrows the type.
			 */
			credential: Credential | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
