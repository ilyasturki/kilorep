<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	import { logout } from '$lib/api/auth';
	import HandoverSheet from '$lib/app/HandoverSheet.svelte';
	import { wireSyncTriggers } from '$lib/app/triggers';
	import AppBar from '$lib/nav/AppBar.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';
	import { slideNavigation } from '$lib/nav/transitions';
	import { getStore } from '$lib/store/store';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	createAppBarSlot();

	slideNavigation();

	// Through a `$derived` so the id is compared rather than the load's result: every
	// `invalidateAll` hands back a fresh `data`, and re-wiring on each one would cancel
	// the debounced sync of the write that caused it.
	const account = $derived(data.user?.id ?? null);

	$effect(() => wireSyncTriggers(account));

	let handoverOpen = $state(false);

	// Raised from an effect rather than bound to `data.stranded` directly: the sheet has
	// to be able to close while the load that opened it still says what it said, and the
	// answer only changes once `handOver` has invalidated it.
	$effect(() => {
		if (data.stranded) {
			handoverOpen = true;
		}
	});

	async function handOver(mode: 'adopt' | 'wipe'): Promise<void> {
		const id = data.user?.id;

		if (id === undefined) {
			return;
		}

		const store = await getStore();

		if (mode === 'wipe') {
			await store.wipe(id);

			activeWorkout.finish();
		} else {
			await store.adopt(id);
		}

		await invalidateAll();
	}

	// Cancelling leaves the browser as it was found, which means leaving the account that
	// cannot have it: staying signed in is the one outcome with nothing to show for it.
	async function abandon(): Promise<void> {
		try {
			await logout();
		} catch {
			/* empty */
		}

		await goto('/login', { invalidateAll: true, replaceState: true });
	}
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<AppBar />

	<!-- `bg-canvas` is not redundant: a view transition captures this element as an image, and
	     with no background it captures transparent — overlapping slide panes would show both screens. -->
	<div class="vt-page flex min-h-0 flex-1 flex-col bg-canvas">
		{@render children()}
	</div>
</div>

<HandoverSheet
	bind:open={handoverOpen}
	place="browser"
	email={data.user?.email ?? null}
	onadopt={() => void handOver('adopt')}
	onwipe={() => void handOver('wipe')}
	oncancel={() => void abandon()}
/>
