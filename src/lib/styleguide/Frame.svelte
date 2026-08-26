<script lang="ts">
	import type { Snippet } from 'svelte';

	import { caption } from '$lib/styleguide/chrome';

	/**
	 * The narrowest phone the app is designed against.
	 *
	 * A card on this sheet is narrower than a phone — the page's own padding and the card's take
	 * about 80px between them — so a frame that simply shrank to fit would show every screen-width
	 * component at a width no phone has, and the two-stepper rows inside them would collapse into
	 * a layout that exists nowhere. The frame holds this and scrolls instead.
	 */
	const PHONE = 360;

	type Props = {
		/** What this frame is standing in for — "phone · 390px", "desktop column". */
		label?: string;
		/**
		 * A screen-width component judged at the width it will actually have.
		 *
		 * `phone` is the gym floor and the default; `column` is the desktop pane.
		 */
		size?: 'phone' | 'column';
		/**
		 * Override the width this component refuses to go below, in px.
		 *
		 * A phone frame already holds a phone. A desktop-shaped one has to say so itself: sum its
		 * fixed tracks and leave the flexible ones room — the ledger's eight columns are 844px
		 * before its title column has taken a pixel.
		 */
		floor?: number;
		/** Paint the canvas behind it — for a component that expects to sit on the page, not a card. */
		canvas?: boolean;
		children: Snippet;
	};

	let { label, size = 'phone', floor, canvas = true, children }: Props = $props();

	const width = $derived(floor ?? (size === 'phone' ? PHONE : undefined));
</script>

<div class="flex w-full flex-col items-start gap-1.5">
	<!-- A phone screen, not a card: components sized for the whole width lie about their weight
	     when they are squeezed into a bento column, and the ones that dock to an edge stop
	     making sense at all. -->
	<div
		class={[
			'w-full rounded-xl border border-line-soft',
			width === undefined ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden',
			size === 'phone' ? 'max-w-[390px]' : 'max-w-full',
			canvas && 'bg-canvas'
		]}
	>
		<div style:min-width={width === undefined ? null : `${width}px`}>
			{@render children()}
		</div>
	</div>

	{#if label !== undefined}<span class={caption}>{label}</span>{/if}
</div>
