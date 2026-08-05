<script lang="ts">
	import { ToggleGroup } from 'bits-ui';

	import { MARK_COLOURS, MARK_ICONS } from '$lib/domain/template';
	import type { MarkColour, MarkIcon, TemplateMark } from '$lib/domain/template';
	import { markLabel, MARK_FILLS, MARK_GLYPHS, MARK_TILES } from '$lib/templates/marks';
	import Button from '$lib/ui/Button.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		open?: boolean;
		mark: TemplateMark | null;
		onpick: (mark: TemplateMark | null) => void;
	};

	let { open = $bindable(false), mark, onpick }: Props = $props();

	const icon = $derived(mark?.icon ?? null);
	const colour = $derived(mark?.colour ?? null);

	const Glyph = $derived(icon === null ? null : MARK_GLYPHS[icon]);

	/**
	 * Half a mark at a time, and no half invented from the other.
	 *
	 * A glyph picked first stays colourless until a hue is chosen — there was a
	 * default blue here once, and a default is a choice the app made and did not
	 * mention. Both grids can also give their half back, so this is the one
	 * place that knows an empty mark is spelled `null` rather than as an object
	 * with nothing in it.
	 */
	function pick(half: Partial<TemplateMark>): void {
		const next = { icon, colour, ...half };

		onpick(next.icon === null && next.colour === null ? null : next);
	}

	/**
	 * A `ToggleGroup` speaks in strings and says `''` for "nothing chosen" — the
	 * empty string being exactly what a second tap on the lit tile produces.
	 * Read back through the set rather than cast, so the value that reaches a
	 * record is one this build named.
	 */
	function asIcon(value: string): MarkIcon | null {
		return MARK_ICONS.find((key) => key === value) ?? null;
	}

	function asColour(value: string): MarkColour | null {
		return MARK_COLOURS.find((key) => key === value) ?? null;
	}
</script>

<Sheet bind:open title="Template icon" description="A mark to find this plan by.">
	<div class="flex flex-col gap-5 px-4 pt-3 pb-4">
		<div>
			<h3 class="pb-2 label-caps">Icon</h3>

			<!-- A grid that wraps rather than a fixed column count: fifteen glyphs
			     at a 56px minimum lands four across on a phone and six on a desk,
			     without either number being written down. -->
			<ToggleGroup.Root
				type="single"
				bind:value={() => icon ?? '', (next) => pick({ icon: asIcon(next) })}
				aria-label="Icon"
				class="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1"
			>
				{#each MARK_ICONS as key (key)}
					{@const Tile = MARK_GLYPHS[key]}

					<!-- Chosen is the hue at full strength, the move `Chip` makes with
					     the accent. The grid used to preview the chosen hue on every
					     tile, which was a fair picture of the mark and a poor picture of
					     the choice: fifteen tiles in one colour, one of them ringed. Now
					     the unchosen are neutral and the chosen one is the only colour
					     in the grid, which is the thing being decided.

					     Branched here rather than under `data-[state=on]:`, because the
					     hue is not known until it is read — the variant would need an
					     interpolated class name, and an interpolated class name is one
					     Tailwind's scanner never generates. -->
					<ToggleGroup.Item value={key} aria-label={markLabel(key)}>
						{#snippet child({ props })}
							<button
								{...props}
								class={[
									'grid min-h-chip place-items-center rounded-xl py-2 focus-ring',
									'pointer-fine:transition-colors pointer-fine:duration-100',
									icon !== key && 'bg-sunken text-ink-muted hover:bg-hover press:bg-surface-2',
									icon === key && (colour === null ? 'bg-ink text-canvas' : MARK_FILLS[colour])
								]}
								{@attach press()}
							>
								<Tile size={22} />
							</button>
						{/snippet}
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</div>

		<div>
			<h3 class="pb-2 label-caps">Colour</h3>

			<!-- Live from the first tap now, where it used to be dimmed and inert
			     until a glyph existed to paint. What made it inert was a mark being
			     both halves or neither; a colour on its own is a mark this build
			     can draw, so there is nothing left to wait for.

			     Each swatch is the mark exactly as the row will draw it — the
			     chosen glyph on the soft tile, or the hue filled solid while there
			     is no glyph. That is not decoration: six soft halves at 30% chroma
			     are six pastels, and teal reads as mint and violet as pink at arm's
			     length. Selection is the ring, since every swatch already has
			     something in it. -->
			<ToggleGroup.Root
				type="single"
				bind:value={() => colour ?? '', (next) => pick({ colour: asColour(next) })}
				aria-label="Colour"
				class="flex flex-wrap gap-2"
			>
				{#each MARK_COLOURS as key (key)}
					<ToggleGroup.Item value={key} aria-label={markLabel(key)}>
						{#snippet child({ props })}
							<button
								{...props}
								class={[
									'grid size-11 place-items-center rounded-xl border-2 focus-ring',
									Glyph === null ? MARK_FILLS[key] : MARK_TILES[key],
									colour === key ? 'border-ink' : 'border-transparent'
								]}
								{@attach press()}
							>
								{#if Glyph !== null}
									<Glyph size={20} />
								{/if}
							</button>
						{/snippet}
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</div>
	</div>

	{#snippet footer()}
		{#if mark !== null}
			<!-- Both halves in one tap. Tapping each lit tile again does the same
			     thing and is the reason the first tap in this sheet is no longer
			     irreversible — but "take the mark off" is one decision, and made
			     one grid at a time it is two taps and a moment of wondering
			     whether the colour counts as a mark on its own. It does. -->
			<Button
				variant="raised"
				class="w-full"
				onclick={() => {
					onpick(null);
					open = false;
				}}
			>
				Clear mark
			</Button>
		{/if}
	{/snippet}
</Sheet>
