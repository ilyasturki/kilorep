<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	import { logout } from '$lib/api/auth';
	import { apiBase, deviceToken, setApiBase } from '$lib/api/client';
	import AccountSection from '$lib/settings/AccountSection.svelte';
	import DangerSection from '$lib/settings/DangerSection.svelte';
	import ServerSection from '$lib/settings/ServerSection.svelte';
	import SetsSection from '$lib/settings/SetsSection.svelte';
	import TokensSection from '$lib/settings/TokensSection.svelte';
	import { getStore } from '$lib/store/store';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { PageProps } from './$types';

	/**
	 * Settings — the last of the four tabs, and everything the loop never needs:
	 * the account, the server, the credentials, the way out.
	 *
	 * Sections earn their place by state rather than by build flag alone:
	 *
	 * - Account, API tokens and Danger exist when someone is signed in.
	 * - Server exists only in the app build, where having one is a choice. On the
	 *   web the origin serving the page *is* the server, and a field for it would
	 *   be a question with one answer.
	 *
	 * Local-only in the app is all of them collapsed to the Server section's two
	 * rows — the layout reads "no server" as an ordinary state and hands
	 * `user: null`, so this screen is where that state can end.
	 *
	 * This file owns only what crosses a section: the credential, the address,
	 * and the minted secret. Signing out is here because it drops the address
	 * that the Server section draws; deleting the account is here because its
	 * aftermath is the store, the connection and a navigation at once.
	 */
	let { data }: PageProps = $props();

	// Whether this device holds a credential, which on the phone is the whole of
	// "signed in". Read from the client rather than from `data.user`, because the
	// two answer different questions: `data.user` is null for an unreachable
	// server too, and a way in is not what that state needs.
	//
	// Derived on `data.user` because a load is what can change the answer behind
	// this screen's back: `request` drops a credential the server refused, and the
	// layout re-runs. The sections below assign it for the window between an
	// action and the load it triggers — a derived value takes an override and goes
	// back to computing itself once its dependency moves.
	let credentialled = $derived.by(() => {
		void data.user;

		return deviceToken() !== null;
	});

	// Mirrored into state because `apiBase()` is module memory the template
	// cannot track. The mirror carries a second meaning the module cannot: it
	// moves only where the user's own action put an address in place, which is
	// what makes an implicit one rollable — see `standTo` in the Server section.
	let server = $state(apiBase());

	// Held here rather than in the token list that draws it: changing a password
	// can revoke the credential it is showing, and the sweep has to be able to
	// take the secret off the screen with it.
	let minted = $state<{ token: string; label: string } | null>(null);

	/**
	 * No navigation on failure — the credential is still live, so /login's
	 * reverse guard would bounce straight back — and `invalidateAll` on the way
	 * out so the layout's session read cannot be served from cache and revive an
	 * account without a credential.
	 *
	 * Throws for the Account section to report. Everything past the `logout` call
	 * is what the phone does with the address, which is why this is not the
	 * section's own business.
	 */
	async function signOut() {
		await logout();

		// The phone has nowhere to be sent. Signing out there drops the device
		// token and leaves the app local-only — the state PRODUCT.md calls the
		// ordinary one — with the way back in appearing in the Server section.
		// Navigating to `/login` would draw the web's card over a working app.
		//
		// The address goes with the credential, and the section returns to what a
		// fresh install shows. Signing in is what connected this phone, so nothing
		// else can honestly disconnect it; `lastServer` survives, which is what
		// stops a self-hoster retyping theirs.
		if (import.meta.env.APP_BUILD) {
			credentialled = false;
			setApiBase(null);
			server = null;

			await invalidateAll();
			return;
		}

		await goto('/login', { invalidateAll: true, replaceState: true });
	}

	/**
	 * The account is gone; this is what is left of it here.
	 *
	 * `keepLocal` is the choice made in the sheet. Keeping means the records stay
	 * and stop belonging to anyone — `disown` — so the next account to sign in on
	 * this device claims them outright. Erasing means `wipe(null)`: an empty
	 * store with no owner, which is a fresh install.
	 *
	 * A session left running ends on the erase path only, where it would
	 * otherwise outlive its own records and write itself back on finish. Keeping
	 * the device means keeping the training on it, and a set logged into a
	 * disowned store is an ordinary dirty record waiting for an owner — killing
	 * a live workout to tidy up an account that is already gone is exactly the
	 * friction hard rule 7 is about.
	 */
	async function afterDelete(keepLocal: boolean) {
		const store = await getStore();

		if (keepLocal) {
			await store.disown();
		} else {
			await store.wipe(null);
			activeWorkout.finish();
		}

		credentialled = false;
		minted = null;

		if (import.meta.env.APP_BUILD) {
			setApiBase(null);
			server = null;

			// Stays on Settings, which is now the fresh-install shape of it: the
			// Server section's two rows and nothing else. Sending the app to the
			// workout screen would swallow the only confirmation there is.
			await invalidateAll();
			return;
		}

		// The web has no account to log in to any more, so `/login` would be a
		// form for nothing.
		await goto('/', { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Settings | Kilorep</title>
</svelte:head>

<!-- No scroll pane of its own any more: Settings is a tab now, and `(tabs)` is
     where every screen in it gets one. Keeping this screen's would have nested
     a scroller inside a scroller — and would have kept it out of that layout's
     scroll snapshot, which is the thing that gives a screen its offset back on
     the way in from history. -->
<main class="column-content flex flex-col gap-6 px-3 pt-3 pb-4">
	<SetsSection userId={data.user?.id ?? null} />

	{#if data.user}
		<AccountSection user={data.user} onsignout={signOut} onrevokedothers={() => (minted = null)} />
	{/if}

	{#if import.meta.env.APP_BUILD}
		<ServerSection
			user={data.user}
			google={data.google}
			bind:credentialled={() => credentialled, (next) => (credentialled = next)}
			bind:server
		/>
	{/if}

	{#if data.tokens !== null}
		<TokensSection tokens={data.tokens} bind:minted />
	{/if}

	{#if data.user}
		<DangerSection user={data.user} ondeleted={afterDelete} />
	{/if}
</main>
