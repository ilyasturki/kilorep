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
	 * Capacitor shell boots into — the marketing page owns `/` on the web, so the
	 * APK redirects past it. The route is not in question, only what fills it:
	 * the real screen is the active workout or the template list, and it waits on
	 * the local store.
	 *
	 * Two shapes, because PRODUCT.md makes the server optional and the phone
	 * complete standalone. With no server there is no account to name and nothing
	 * to sign out of, so the screen is one action and says so. With a server it is
	 * additionally the smallest thing that proves the credential is real and can
	 * be given back.
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
	<title>Start | Kilorep</title>
</svelte:head>

<!--
	`justify-end` and `pb-safe-b`: the action sits in the thumb zone, which is
	where DESIGN.md puts anything pressed with one hand on a gym floor, and the
	inset keeps it clear of the gesture bar on a device drawing edge to edge.
-->
<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-end gap-8 px-4 pt-safe-t pb-safe-b">
	<header class="flex flex-col gap-1.5 pt-10">
		<h1 class="text-2xl font-extrabold tracking-tight">Kilorep</h1>

		{#if data.user}
			<p class="text-md break-all text-ink-muted">{data.user.email}</p>
		{/if}
	</header>

	<div class="flex flex-1 flex-col justify-end gap-3 pb-4">
		<p class="text-md text-pretty text-ink-muted">
			Start is a placeholder. The template list lands with the local store.
		</p>

		<!--
			The one filled button on the screen, per Button's own rule. It is not a
			commit in the accent's sense — nothing is being logged — but Start has a
			single primary action and `commit` is the only look sized for the thumb.
		-->
		<Button variant="commit" href="/workout">Start workout</Button>

		{#if data.user}
			<Button variant="secondary" disabled={pending} onclick={signOut}>
				{pending ? 'Signing out…' : 'Sign out'}
			</Button>

			<div aria-live="polite">
				{#if signOutError !== ''}
					<p class="text-sm font-bold text-danger">{signOutError}</p>
				{/if}
			</div>
		{/if}
	</div>
</main>
