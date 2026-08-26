<script lang="ts">
	import type { Snippet } from 'svelte';

	import { card, caption } from '$lib/styleguide/chrome';

	type Props = {
		/** The component's own name, spelled the way it is imported. */
		name: string;
		/** Where it is used in the app, when that is not obvious from the name. */
		note?: string;
		/** Rows this card claims in the bento — for a specimen that needs the height. */
		tall?: boolean;
		/** Columns this card claims — for a screen-width component that cannot be cropped. */
		wide?: boolean;
		children: Snippet;
	};

	let { name, note, tall = false, wide = false, children }: Props = $props();
</script>

<article class={[card, tall && 'row-span-2', wide && 'col-span-full']}>
	<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
		<h3 class="label-caps">{name}</h3>
		{#if note !== undefined}<span class={caption}>{note}</span>{/if}
	</div>

	{@render children()}
</article>
