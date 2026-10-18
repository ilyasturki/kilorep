<script lang="ts">
	import { decimal, shown } from '$lib/format/locale';
	import { scaleName, shownExertion } from '$lib/domain/exertion';
	import { gripLabel, settleGrip } from '$lib/domain/grip';
	import type { SetCursor } from '$lib/domain/workout';
	import { exerciseHref } from '$lib/exercises/link';
	import { loadModeNote, setFigures } from '$lib/exercises/label';
	import type { Figure } from '$lib/history/editor.svelte';
	import FigureCell from '$lib/history/FigureCell.svelte';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import { press } from '$lib/ui/press';
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
		/** The record's own address, which the exercise's page walks back to. */
		from: string;
		editing: boolean;
		/** A figure taken focus while the record is only being read. */
		onbegin: () => void;
		onfigure: (setId: string, which: Figure, value: number | null) => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (exerciseId: string, anchor: HTMLElement) => void;
		/** A set, or a round across a superset's legs. */
		onadd: () => void;
	};

	let {
		legs,
		cursors,
		badges,
		instead,
		from,
		editing,
		onbegin,
		onfigure,
		onoptions,
		onexercise,
		onadd
	}: Props = $props();

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

	function setName(cursor: SetCursor, letter: string): string {
		return cursor.workingIndex < 0
			? `Warmup ${letter}`.trim()
			: `Set ${letter}${cursor.workingIndex + 1}`;
	}
</script>

{#snippet title(leg: Group, note: string)}
	{#if editing}
		<!-- The exercise's page is reached from inside its options while editing. -->
		<button
			type="button"
			aria-label="{leg.meta.name} options"
			onclick={(e) => onexercise(leg.id, e.currentTarget)}
			class="flex min-h-11 min-w-0 flex-1 press-sink items-center gap-2 rounded-xl px-1 text-left
				focus-ring hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-base font-extrabold text-ink">{leg.meta.name}</span>
				{#if note}
					<span class="block truncate text-sm font-bold text-ink-faint">{note}</span>
				{/if}
			</span>
			<CaretDown size={16} class="shrink-0 text-ink-faint" />
		</button>
	{:else}
		<div class="min-w-0 flex-1 px-1">
			<h2 class="truncate text-base font-extrabold text-ink">
				<a
					href={exerciseHref(leg.meta.id, settleGrip(leg.meta, leg.grip), from)}
					class="rounded-md focus-ring hover:underline">{leg.meta.name}</a
				>
			</h2>
			{#if note}
				<p class="truncate text-sm font-bold text-ink-faint">{note}</p>
			{/if}
		</div>
	{/if}
{/snippet}

<section class="flex flex-col rounded-2xl bg-surface p-3 pb-1">
	{#if superset}
		<div class="flex flex-col gap-1 pb-2">
			<h2 class="px-1 label-caps text-accent-text">Superset</h2>

			{#each legs as leg, at (leg.id)}
				<div class="flex items-center gap-2">
					<span class="w-4 shrink-0 pl-1 text-base font-extrabold text-accent-text">
						{legLetter(at)}
					</span>

					{@render title(leg, noteOf(leg))}

					{#each badges(leg) as badge (badge)}
						<Badge>{badge}</Badge>
					{/each}
				</div>

				{#if leg.note !== undefined}
					<p class="pl-7 text-sm font-bold text-ink-muted">{leg.note}</p>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="flex items-center gap-2 pb-2">
			{@render title(legs[0], noteOf(legs[0]))}

			{#each badges(legs[0]) as badge (badge)}
				<Badge>{badge}</Badge>
			{/each}
		</div>

		{#if legs[0].note !== undefined}
			<p class="px-1 pb-2 text-sm font-bold text-ink-muted">{legs[0].note}</p>
		{/if}
	{/if}

	<div class="{grid} min-h-7 content-center">
		<span class="text-center label-caps">Set</span>
		<span class="px-2 text-right label-caps">kg</span>
		<span class="px-2 text-right label-caps">Reps</span>
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
		{@const name = setName(cursor, letter)}
		{@const mark = `${letter}${warmup ? 'W' : cursor.workingIndex + 1}`}

		<div
			class={[
				grid,
				'min-h-11 border-t',
				opensRound(at) ? 'border-line' : 'border-line-soft',
				editing && 'py-1',
				warmup && 'opacity-[0.72]'
			]}
			{@attach press(() => (editing ? (anchor) => onoptions(set.id, anchor) : undefined))}
		>
			{#if editing}
				<!-- The only logged/unlogged mark the row carries while editing. -->
				<button
					type="button"
					aria-label="{name} options, {set.completed ? 'logged' : 'not logged'}"
					onclick={(e) => onoptions(set.id, e.currentTarget)}
					class={[
						'grid h-9 min-w-9 place-items-center justify-self-center rounded-full px-1 text-sm',
						'font-extrabold focus-ring',
						set.completed
							? 'bg-accent-soft text-accent-text'
							: 'border-[1.5px] border-dashed border-line text-ink-faint'
					]}
				>
					{mark}
				</button>
			{:else}
				<span class="text-center text-sm font-extrabold text-ink-faint">{mark}</span>
			{/if}

			<FigureCell
				kind="weight"
				value={set.weight}
				shown={setFigures(leg.meta, set.weight, set.reps).load ?? ''}
				label="{name} kg"
				{editing}
				class={num}
				{onbegin}
				oncommit={(value) => onfigure(set.id, 'weight', value)}
			/>
			<FigureCell
				kind="reps"
				value={set.reps}
				shown={shown(set.reps)}
				label="{name} reps"
				{editing}
				class={strayed ? 'font-extrabold text-accent-text' : num}
				{onbegin}
				oncommit={(value) => onfigure(set.id, 'reps', value)}
			/>

			<span class="{cell} {dim}">{shown(set.plannedReps)}</span>
			<span class="{cell} {dim}"
				>{set.rpe === null ? '–' : decimal(shownExertion(set.rpe, scale))}</span
			>

			{#if said !== null}
				<span class="col-span-4 col-start-2 pb-1.5 text-right text-sm font-bold text-ink-faint">
					{said}
				</span>
			{/if}
		</div>
	{/each}

	{#if editing}
		<div class="-mx-3 border-t border-line-soft">
			<AddRow
				flush
				label={superset ? 'Add round' : 'Add set'}
				icon={RowsPlusBottom}
				onclick={onadd}
			/>
		</div>
	{/if}
</section>
