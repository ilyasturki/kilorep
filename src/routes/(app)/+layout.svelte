<script lang="ts">
	import AppBar from '$lib/nav/AppBar.svelte';
	import { createAppBarSlot } from '$lib/nav/bar.svelte';
	import { slideNavigation } from '$lib/nav/transitions';

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

	// Route changes slide — the direction logic and the reason it lives on this
	// group are in `nav/transitions.ts`. Here for the same reason the bar is:
	// every app route belongs to `(app)`, so a screen added later slides
	// without its author having to remember.
	slideNavigation();
</script>

<div class="flex h-dvh flex-col bg-canvas text-ink">
	<AppBar />

	<!-- `vt-page` is the box the route transitions slide, and it lives here
	     rather than on each screen so that it is the *same rectangle* on both
	     sides of every navigation. It used to be declared twice — once by the
	     tab layout, once by Settings — and those two boxes were different
	     widths and different heights, so the browser spent the slide morphing
	     one into the other on top of the travel. A single box owned by the
	     shell cannot disagree with itself.

	     `bg-canvas` and not merely the parent's: a view transition captures
	     this element as an image, and an element with no background of its own
	     captures transparent. Two panes overlap during a depth slide, and
	     through a transparent one you would read both screens at once.

	     The bar above stays outside it on purpose — it is the same bar on both
	     sides of every navigation, and chrome that travels with the page it
	     belongs *over* reads as the whole screen tearing away. -->
	<div class="vt-page flex min-h-0 flex-1 flex-col bg-canvas">
		{@render children()}
	</div>
</div>
