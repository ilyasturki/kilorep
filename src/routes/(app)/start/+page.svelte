<script lang="ts">
	import { goto } from '$app/navigation';

	import { logout } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Button from '$lib/ui/Button.svelte';

	import type { PageProps } from './$types';

	/**
	 * A placeholder on a settled address, not a design.
	 *
	 * `/start` is where PRODUCT.md says the app always opens, and the address the
	 * Capacitor shell will boot into — the marketing page owns `/`, so the APK
	 * cannot. The route is not in question, only what fills it: the real screen
	 * is the active workout or the template list, and
	 * it waits on the local store and the domain model. What is here is the
	 * smallest thing that proves the credential is real and can be given back.
	 */

	let { data }: PageProps = $props();

	let signOutError = $state('');
	let pending = $state(false);

	async function signOut() {
		signOutError = '';
		pending = true;

		try {
			await logout();
		} catch (error) {
			// Deliberately no navigation on failure. Leaving for `/login` would
			// look like a sign-out and be none: the credential is still live, so
			// the reverse guard there would read the session and send this screen
			// straight back, having told nobody why.
			signOutError = error instanceof ApiError ? error.message : 'could not sign out, try again';
			pending = false;
			return;
		}

		// `invalidateAll` so the layout's session read cannot be served from
		// cache and revive an account that no longer has a credential.
		await goto('/login', { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Start — Kilorep</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
	<header class="flex flex-col gap-1.5">
		<p class="label-caps">Signed in as</p>
		<h1 class="text-xl font-extrabold tracking-tight break-all">{data.user.email}</h1>
	</header>

	<p class="text-md text-pretty text-ink-muted">
		Start is a placeholder. The template list and the active workout land with the local store.
	</p>

	<div class="flex flex-col gap-3">
		<Button variant="secondary" disabled={pending} onclick={signOut}>
			{pending ? 'Signing out…' : 'Sign out'}
		</Button>

		<div aria-live="polite">
			{#if signOutError !== ''}
				<p class="text-sm font-bold text-danger">{signOutError}</p>
			{/if}
		</div>
	</div>
</main>
