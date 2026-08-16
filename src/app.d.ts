import type { Credential } from '$lib/server/auth/session';

declare global {
	interface ImportMetaEnv {
		readonly APP_BUILD: boolean;

		readonly DEFAULT_SERVER: string;
	}

	namespace App {
		interface Locals {
			credential: Credential | null;
		}
	}
}

export {};
