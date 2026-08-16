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

	function pick(half: Partial<TemplateMark>): void {
		const next = { icon, colour, ...half };

		onpick(next.icon === null && next.colour === null ? null : next);
	}

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

			<ToggleGroup.Root
				type="single"
				bind:value={() => icon ?? '', (next) => pick({ icon: asIcon(next) })}
				aria-label="Icon"
				class="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1"
			>
				{#each MARK_ICONS as key (key)}
					{@const Tile = MARK_GLYPHS[key]}

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
