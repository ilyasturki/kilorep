<script lang="ts">
	import AppBar from '$lib/nav/AppBar.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';

	import type { LayoutProps } from './$types';

	/**
	 * The app's shell: the viewport, and the top bar across it from `lg` up.
	 *
	 * It lives on `(app)` for the same reason `+layout.ts` beside it does — this
	 * is the group every app route belongs to, so chrome placed here reaches a
	 * screen added later without its author having to remember. `(tabs)` cannot
	 * host it: the Workout screen deliberately sits outside that group and still
	 * wants the bar on a desk.
	 *
	 * The height is owned here too, which is what lets the two children below it
	 * be plain `flex-1` boxes instead of each declaring `h-dvh` and hoping they
	 * agree.
	 */
	let { children }: LayoutProps = $props();

	createAppBarSlot();
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<AppBar />

	{@render children()}
</div>
