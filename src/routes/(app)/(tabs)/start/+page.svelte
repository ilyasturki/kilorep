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
	`justify-end`: the action sits in the thumb zone, which is where DESIGN.md
	puts anything pressed with one hand on a gym floor. `min-h-full` rather than
	`min-h-dvh`, and no safe-area inset of its own: the (app) layout owns the
	viewport now, and the tab bar below carries the gesture-bar clearance.

	Centred from `lg` up instead, because the thumb zone is a one-handed-phone
	idea and there is no thumb at a desk — only a lone button sitting in the last
	200px of a tall window with a wall of nothing above it. `column-action` and
	not `column-content`: this screen is one decision, and a button stretched to
	768px is worse than a narrow one, not better.
-->
<main
	class="column-action flex min-h-full flex-col justify-end gap-8 px-4 pt-safe-t pb-4
		lg:justify-center lg:pt-0"
>
	<header class="flex flex-col gap-1.5 pt-10 lg:pt-0">
		<!-- The bar above carries the wordmark from `lg` up; twice on one screen
		     is once too many. -->
		<h1 class="text-2xl font-extrabold tracking-tight lg:hidden">Kilorep</h1>

		{#if data.user}
			<p class="text-md break-all text-ink-muted">{data.user.email}</p>
		{/if}
	</header>

	<!-- `flex-1` is what pushes the action into the thumb zone, so it is also
	     what has to stop above `lg` — left on, it would eat the whole window and
	     there would be nothing for the centring to do. -->
	<div class="flex flex-1 flex-col justify-end gap-3 pb-4 lg:flex-none lg:pb-0">
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
