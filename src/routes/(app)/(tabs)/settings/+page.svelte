<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	import { logout } from '$lib/api/auth';
	import { apiBase, deviceToken, setApiBase } from '$lib/api/client';
	import AccountSection from '$lib/settings/AccountSection.svelte';
	import DangerSection from '$lib/settings/DangerSection.svelte';
	import Section from '$lib/settings/Section.svelte';
	import ServerSection from '$lib/settings/ServerSection.svelte';
	import SetsSection from '$lib/settings/SetsSection.svelte';
	import SyncRow from '$lib/settings/SyncRow.svelte';
	import TokensSection from '$lib/settings/TokensSection.svelte';
	import { getStore } from '$lib/store/store';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let credentialled = $derived.by(() => {
		// `void data.user`: re-reads the credential whenever a load lands.
		void data.user;

		return deviceToken() !== null;
	});

	let server = $state(apiBase());

	let minted = $state<{ token: string; label: string } | null>(null);

	let leaveOpen = $state(false);

	// The server first: a sign-out that failed is one that did not happen, and erasing
	// ahead of it would take the records with nothing to show for it.
	async function leave() {
		await logout();

		if (import.meta.env.APP_BUILD) {
			credentialled = false;
			setApiBase(null);
			server = null;

			await invalidateAll();
			return;
		}

		const store = await getStore();

		await store.wipe(null);
		activeWorkout.finish();

		await goto('/login', { invalidateAll: true, replaceState: true });
	}

	// A phone is one person's; a browser is whoever sits down next, and what is left in it
	// is theirs to walk into — which is how a store ends up claimed by a stranger. So the
	// web hands the browser back empty. The question is only asked over records that would
	// go with it: at zero there is nothing to lose and it would be ceremony.
	async function signOut() {
		if (import.meta.env.APP_BUILD) {
			await leave();
			return;
		}

		const store = await getStore();

		if ((await store.pendingCount()) > 0) {
			leaveOpen = true;
			return;
		}

		await leave();
	}

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

			await invalidateAll();
			return;
		}

		await goto('/', { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Settings | Kilorep</title>
</svelte:head>

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
	{:else if data.user}
		<!-- The phone reads this row inside its Server section, next to the address it is
		     syncing with. The web has one server and never says so, so the row stands alone —
		     but it is the same row, and it is the only thing in this build that can say a
		     stall out loud. -->
		<Section title="Sync">
			<SyncRow userId={data.user.id} credentialled />
		</Section>
	{/if}

	{#if data.tokens !== null}
		<TokensSection tokens={data.tokens} bind:minted />
	{/if}

	{#if data.user}
		<DangerSection user={data.user} ondeleted={afterDelete} />
	{/if}
</main>

<AlertDialog
	bind:open={leaveOpen}
	title="Sign out with changes still here?"
	description="Some of what was logged in this browser never reached the server. Signing out erases it along with the rest, and there is no undo."
	confirmLabel="Sign out"
	onconfirm={() => void leave()}
/>
