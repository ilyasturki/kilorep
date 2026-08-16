<script lang="ts">
	import AppBar from '$lib/nav/AppBar.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';
	import { slideNavigation } from '$lib/nav/transitions';

	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	createAppBarSlot();

	slideNavigation();
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<AppBar />

	<!-- `bg-canvas` is not redundant: a view transition captures this element as an image, and
	     with no background it captures transparent — overlapping slide panes would show both screens. -->
	<div class="vt-page flex min-h-0 flex-1 flex-col bg-canvas">
		{@render children()}
	</div>
</div>
