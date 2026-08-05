<script lang="ts">
	import { MARK_COLOURS, MARK_ICONS } from '$lib/domain/template';
	import type { MarkColour, TemplateMark } from '$lib/domain/template';
	import { markLabel, MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		open?: boolean;
		mark: TemplateMark | null;
		onpick: (mark: TemplateMark | null) => void;
	};

	let { open = $bindable(false), mark, onpick }: Props = $props();

	/**
	 * The hue a first-ever icon arrives wearing.
	 *
	 * Something has to be, because the glyph is picked before the colour and a
	 * mark is both or neither. Blue rather than a rotation through the six: a
	 * default that changes per template is a choice the app made and did not
	 * mention, and the swatches are one tap below the grid for anyone who
	 * wanted a different one.
	 */
	const DEFAULT_COLOUR: MarkColour = 'blue';

	function chooseColour(colour: MarkColour): void {
		if (mark === null) {
			return;
		}

		onpick({ ...mark, colour });
	}
</script>

<Sheet bind:open title="Template icon" description="A mark to find this plan by.">
	<div class="flex flex-col gap-5 px-4 pt-3 pb-4">
		<div>
			<h3 class="pb-2 label-caps">Icon</h3>

			<!-- A grid that wraps rather than a fixed column count: fifteen glyphs
			     at a 56px minimum lands four across on a phone and six on a desk,
			     without either number being written down. -->
			<div class="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1">
				{#each MARK_ICONS as icon (icon)}
					{@const Glyph = MARK_GLYPHS[icon]}
					{@const chosen = mark?.icon === icon}

					<button
						type="button"
						aria-pressed={chosen}
						aria-label={markLabel(icon)}
						onclick={() => onpick({ icon, colour: mark?.colour ?? DEFAULT_COLOUR })}
						class={[
							'grid min-h-chip place-items-center rounded-xl border py-2 focus-ring',
							'hover:bg-hover press:bg-surface-2',
							chosen ? 'border-ink' : 'border-line-soft',
							// The tile wears the chosen hue as soon as there is one, so the
							// grid is a preview of the mark rather than a list of shapes.
							mark === null ? 'text-ink-muted' : MARK_TILES[mark.colour]
						]}
						{@attach press()}
					>
						<Glyph size={22} />
					</button>
				{/each}
			</div>
		</div>

		<div>
			<h3 class="pb-2 label-caps">Colour</h3>

			<!-- Inert until there is a glyph to paint. A mark is a shape *and* a
			     hue, so a colour chosen against nothing would have to invent the
			     shape to go with it — and an invented glyph is the one thing a
			     picker should never hand back. Dimmed and `aria-disabled` rather
			     than hidden, so the second half of the choice is visible from the
			     first tap rather than appearing out of nowhere. -->
			<div class={['flex flex-wrap gap-2', mark === null && 'pointer-events-none opacity-40']}>
				{#each MARK_COLOURS as colour (colour)}
					{@const chosen = mark?.colour === colour}
					{@const Glyph = mark === null ? null : MARK_GLYPHS[mark.icon]}

					<!-- The chosen glyph inside every swatch, not a bare tile.
					     A tile alone shows only the soft half of a hue, and six soft
					     halves at 30% chroma are six pastels — teal read as mint and
					     violet as pink at arm's length. With the saturated glyph on it
					     each swatch is the mark exactly as the row will draw it, which
					     is both easier to tell apart and the thing actually being
					     chosen. Selection is the ring; nothing needs a tick once every
					     swatch has something in it. -->
					<button
						type="button"
						aria-pressed={chosen}
						aria-disabled={mark === null}
						aria-label={markLabel(colour)}
						onclick={() => chooseColour(colour)}
						class={[
							'grid size-11 place-items-center rounded-xl border-2 focus-ring',
							MARK_TILES[colour],
							chosen ? 'border-ink' : 'border-transparent'
						]}
						{@attach press()}
					>
						{#if Glyph !== null}
							<Glyph size={20} />
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#snippet footer()}
		{#if mark !== null}
			<!-- The way back to unmarked. Without it the first tap in this sheet
			     would be irreversible, and "no mark" is a state the list draws on
			     purpose rather than a state a template is stuck before. -->
			<Button
				variant="raised"
				class="w-full"
				onclick={() => {
					onpick(null);
					open = false;
				}}
			>
				Remove icon
			</Button>
		{/if}
	{/snippet}
</Sheet>
