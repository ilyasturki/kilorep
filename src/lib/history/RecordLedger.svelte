<script lang="ts">
	import { scaleName, shownExertion } from '$lib/domain/exertion';
	import { gripLabel } from '$lib/domain/grip';
	import type { SetCursor } from '$lib/domain/workout';
	import { loadModeNote, setFigures } from '$lib/exercises/label';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { legLetter, setNote } from '$lib/workout/groups';
	import type { Group } from '$lib/workout/groups';

	type Props = {
		/** One leg, or a superset's legs in lifting order. */
		legs: Group[];
		/** The entry's sets in lifting order: a superset's rounds, interleaved. */
		cursors: SetCursor[];
		badges: (leg: Group) => string[];
		/** The planned exercise's name, where this leg was swapped in for it. */
		instead: (leg: Group) => string | undefined;
	};

	let { legs, cursors, badges, instead }: Props = $props();

	const superset = $derived(legs.length > 1);

	function noteOf(leg: Group): string {
		const planned = instead(leg);

		return [
			leg.meta.equipment,
			loadModeNote(leg.meta.loadMode),
			gripLabel(leg.meta, leg.grip),
			planned === undefined ? null : `instead of ${planned}`
		]
			.filter(Boolean)
			.join(' · ');
	}

	const letters = $derived(new Map(legs.map((leg, at) => [leg.id, superset ? legLetter(at) : ''])));

	function legOf(cursor: SetCursor): Group {
		return legs.find((leg) => leg.id === cursor.exercise.id) ?? legs[0];
	}

	function opensRound(at: number): boolean {
		return superset && at > 0 && cursors[at].workingIndex !== cursors[at - 1].workingIndex;
	}

	const scale = $derived(exertionScale.current);

	// Every card on the page shares the template, so a column reads straight down across exercises.
	const grid = 'grid grid-cols-[36px_repeat(4,minmax(0,1fr))] items-center gap-x-2';

	const cell = 'text-right text-md tracking-numeral tabular-nums';
	const dim = 'font-bold text-ink-faint';

	const show = (n: number | null) => (n === null ? '–' : String(n));
</script>

<section class="flex flex-col rounded-2xl bg-surface p-3 pb-1">
	{#if superset}
		<div class="flex flex-col gap-1 px-1 pb-2">
			<h2 class="label-caps text-accent-text">Superset</h2>

			{#each legs as leg, at (leg.id)}
				{@const note = noteOf(leg)}

				<div class="flex items-center gap-2">
					<span class="w-4 shrink-0 text-base font-extrabold text-accent-text">
						{legLetter(at)}
					</span>

					<p class="flex min-w-0 flex-1 items-baseline gap-2">
						<span class="truncate text-base font-extrabold text-ink">{leg.meta.name}</span>
						{#if note}
							<span class="min-w-0 shrink-[2] truncate text-sm font-bold text-ink-faint">
								{note}
							</span>
						{/if}
					</p>

					{#each badges(leg) as badge (badge)}
						<Badge>{badge}</Badge>
					{/each}
				</div>

				{#if leg.note !== undefined}
					<p class="pl-6 text-sm font-bold text-ink-muted">{leg.note}</p>
				{/if}
			{/each}
		</div>
	{:else}
		{@const note = noteOf(legs[0])}

		<div class="flex items-center gap-2 px-1 pb-2">
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-base font-extrabold text-ink">{legs[0].meta.name}</h2>
				{#if note}
					<p class="truncate text-sm font-bold text-ink-faint">{note}</p>
				{/if}
				{#if legs[0].note !== undefined}
					<p class="pt-0.5 text-sm font-bold text-ink-muted">{legs[0].note}</p>
				{/if}
			</div>

			{#each badges(legs[0]) as badge (badge)}
				<Badge>{badge}</Badge>
			{/each}
		</div>
	{/if}

	<div class="{grid} min-h-7 content-center">
		<span class="label-caps">Set</span>
		<span class="text-right label-caps">kg</span>
		<span class="text-right label-caps">Reps</span>
		<span class="text-right label-caps">Plan</span>
		<span class="text-right label-caps">{scaleName(scale)}</span>
	</div>

	{#each cursors as cursor, at (cursor.set.id)}
		{@const set = cursor.set}
		{@const leg = legOf(cursor)}
		{@const letter = letters.get(leg.id) ?? ''}
		{@const warmup = set.type === 'warmup'}
		{@const said = setNote(leg.meta, leg.grip, set)}
		{@const strayed =
			!warmup && set.completed && set.plannedReps !== null && set.reps !== set.plannedReps}
		{@const ink = warmup ? 'text-ink-muted' : 'text-ink'}
		{@const num = set.completed ? `font-extrabold ${ink}` : dim}

		<div
			class={[
				grid,
				'min-h-9 border-t',
				opensRound(at) ? 'border-line' : 'border-line-soft',
				warmup && 'opacity-[0.72]'
			]}
		>
			<span class="text-sm font-extrabold text-ink-faint">
				{letter}{warmup ? 'W' : cursor.workingIndex + 1}
			</span>

			<span class="{cell} {num}">
				{setFigures(leg.meta, set.weight, set.reps).load ?? ''}
			</span>
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
