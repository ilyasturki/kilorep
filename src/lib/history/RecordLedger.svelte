<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import { scaleName, shownExertion } from '$lib/domain/exertion';
	import { gripLabel } from '$lib/domain/grip';
	import type { SetCursor } from '$lib/domain/workout';
	import { loadModeNote } from '$lib/exercises/label';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { setNote } from '$lib/workout/groups';

	type Props = {
		meta: Exercise;
		grip?: string;
		cursors: SetCursor[];
		badges: string[];
	};

	let { meta, grip, cursors, badges }: Props = $props();

	const note = $derived(
		[meta.equipment, loadModeNote(meta.loadMode), gripLabel(meta, grip)].filter(Boolean).join(' · ')
	);

	const scale = $derived(exertionScale.current);

	// Every card on the page shares the template, so a column reads straight down across exercises.
	const grid = 'grid grid-cols-[36px_repeat(4,minmax(0,1fr))] items-center gap-x-2';

	const cell = 'text-right text-md tracking-numeral tabular-nums';
	const dim = 'font-bold text-ink-faint';

	const show = (n: number | null) => (n === null ? '–' : String(n));
</script>

<section class="flex flex-col rounded-2xl bg-surface p-3 pb-1">
	<div class="flex items-center gap-2 px-1 pb-2">
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-base font-extrabold text-ink">{meta.name}</h2>
			{#if note}
				<p class="truncate text-sm font-bold text-ink-faint">{note}</p>
			{/if}
		</div>

		{#each badges as badge (badge)}
			<Badge>{badge}</Badge>
		{/each}
	</div>

	<div class="{grid} min-h-7 content-center">
		<span class="label-caps">Set</span>
		<span class="text-right label-caps">kg</span>
		<span class="text-right label-caps">Reps</span>
		<span class="text-right label-caps">Plan</span>
		<span class="text-right label-caps">{scaleName(scale)}</span>
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{@const set = cursor.set}
		{@const warmup = set.type === 'warmup'}
		{@const said = setNote(meta, grip, set)}
		{@const strayed = set.completed && set.plannedReps !== null && set.reps !== set.plannedReps}
		{@const ink = warmup ? 'text-ink-muted' : 'text-ink'}
		{@const num = set.completed ? `font-extrabold ${ink}` : dim}

		<div class={[grid, 'min-h-9 border-t border-line-soft', warmup && 'opacity-[0.72]']}>
			<span class="text-sm font-extrabold text-ink-faint">
				{warmup ? 'W' : cursor.workingIndex + 1}
			</span>

			<span class="{cell} {num}">{show(set.weight)}</span>
			<span class="{cell} {strayed ? 'font-extrabold text-accent-text' : num}">
				{show(set.reps)}
			</span>

			<span class="{cell} {dim}">{show(set.plannedReps)}</span>
			<span class="{cell} {dim}">{set.rpe === null ? '–' : shownExertion(set.rpe, scale)}</span>

			{#if said !== null}
				<span class="col-span-4 col-start-2 pb-1.5 text-right text-sm font-bold text-ink-faint">
					{said}
				</span>
			{/if}
		</div>
	{/each}
</section>
