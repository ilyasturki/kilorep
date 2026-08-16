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

	let { data }: PageProps = $props();

	let credentialled = $derived.by(() => {
		// `void data.user`: re-reads the credential whenever a load lands.
		void data.user;

		return deviceToken() !== null;
	});

	let server = $state(apiBase());

	let minted = $state<{ token: string; label: string } | null>(null);

	async function signOut() {
		await logout();

		if (import.meta.env.APP_BUILD) {
			credentialled = false;
			setApiBase(null);
			server = null;

			await invalidateAll();
			return;
		}

		await goto('/login', { invalidateAll: true, replaceState: true });
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
	{/if}

	{#if data.tokens !== null}
		<TokensSection tokens={data.tokens} bind:minted />
	{/if}

	{#if data.user}
		<DangerSection user={data.user} ondeleted={afterDelete} />
	{/if}
</main>
