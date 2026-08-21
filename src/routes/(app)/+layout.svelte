<script lang="ts">
	import AppBar from '$lib/nav/AppBar.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';
	import { slideNavigation } from '$lib/nav/transitions';
	import { wireSyncTriggers } from '$lib/app/triggers';

	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	createAppBarSlot();

	slideNavigation();

	// Through a `$derived` so the id is compared rather than the load's result: every
	// `invalidateAll` hands back a fresh `data`, and re-wiring on each one would cancel
	// the debounced sync of the write that caused it.
	const account = $derived(data.user?.id ?? null);

	$effect(() => wireSyncTriggers(account));
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<AppBar />

	<!-- `bg-canvas` is not redundant: a view transition captures this element as an image, and
	     with no background it captures transparent — overlapping slide panes would show both screens. -->
	<div class="vt-page flex min-h-0 flex-1 flex-col bg-canvas">
		{@render children()}
	</div>
</div>
