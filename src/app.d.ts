// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Credential } from '$lib/server/auth/session';

declare global {
	/**
	 * Vite declares `ImportMetaEnv` globally; this augments it. Inside `declare
	 * global` and not beside it, because this file has imports and is therefore a
	 * module — a bare `interface` here would be module-scoped and merge with
	 * nothing, leaving `import.meta.env.APP_BUILD` as `any` and every branch on
	 * it a lint error rather than a type.
	 */
	interface ImportMetaEnv {
		/**
		 * True in the bundle Capacitor wraps, false in the one the server hosts.
		 * Substituted literally by `define` in vite.config.ts — see the comment
		 * there for why it is not a `VITE_`-prefixed variable.
		 */
		readonly APP_BUILD: boolean;

		/**
		 * Where the app build offers to sign in, scheme and host, no trailing
		 * slash. A default for the form on the Server screen and never for
		 * `apiBase` — see the constant in `$lib/api/client`.
		 */
		readonly DEFAULT_SERVER: string;
	}

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
