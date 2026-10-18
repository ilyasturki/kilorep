<script lang="ts">
	import { slide } from 'svelte/transition';

	import { exertionLabel } from '$lib/domain/exertion';
	import { canCommit, prefillFor } from '$lib/domain/workout';
	import { gripLabel } from '$lib/domain/grip';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { setFigures } from '$lib/exercises/label';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { smallMs } from '$lib/ui/motion';
	import { press } from '$lib/ui/press';
	import type { LastNotes } from '$lib/store/derive';
	import { legLetter, setNote, statusOf } from '$lib/workout/groups';
	import type { Group } from '$lib/workout/groups';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import SwipeRow from '$lib/workout/SwipeRow.svelte';

	type Props = {
		/** One leg, or a superset's legs in lifting order. */
		legs: Group[];
		/** The entry's sets in lifting order: a superset's rounds, interleaved. */
		cursors: SetCursor[];
		history: History;
		/** Last time's notes, each drawn under the heading until this session writes its own. */
		notes?: LastNotes;
		activeSetId: string | null;
		/**
		 * How much of the list's bottom edge something else stands over — the tray. A row has
		 * to clear it to count as revealed, and nothing in the list can see what covers it.
		 */
		floor?: number;
		onselect: (setId: string) => void;
		onquick: (setId: string, weight: number, reps: number) => void;
		/** Absent, a logged row cannot be taken back by a gesture. */
		onunlog?: (setId: string) => void;
		/** Absent, no row here can be swiped away. */
		onremove?: (setId: string) => void;
		/** A set, or on a superset a round: one set on every leg. */
		onadd: () => void;
		oninsert?: () => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (legId: string, anchor: HTMLElement) => void;
	};

	let {
		legs,
		cursors,
		history,
		notes = {},
		activeSetId,
		floor = 0,
		onselect,
		onquick,
		onunlog,
		onremove,
		onadd,
		oninsert,
		onoptions,
		onexercise
	}: Props = $props();

	const superset = $derived(legs.length > 1);

	const lone = $derived(legs[0]);

	const optional = $derived(lone.cursors[0]?.exercise.optional === true);

	// The equipment line already carries a word about the setup, so the grip joins it there
	// rather than taking a row of its own: it is read on the way past, and changed by a press
	// on the same heading, which is where the options for this exercise already live.
	const setup = $derived(
		[lone.meta.equipment, gripLabel(lone.meta, lone.grip)].filter(Boolean).join(' · ')
	);

	const owners = $derived(
		new Map(legs.map((leg, at) => [leg.id, { leg, letter: superset ? legLetter(at) : undefined }]))
	);

	function ownerOf(cursor: SetCursor): { leg: Group; letter: string | undefined } {
		return owners.get(cursor.exercise.id) ?? { leg: lone, letter: undefined };
	}

	function offerOf(cursor: SetCursor): { weight: number | null; reps: number | null } {
		return prefillFor(cursor, history, ownerOf(cursor).leg.meta);
	}

	// One gesture logs the numbers the row shows; a row with nothing to offer has no gesture.
	function quickOf(cursor: SetCursor): { weight: number; reps: number } | null {
		if (cursor.set.completed) {
			return null;
		}

		const offer = offerOf(cursor);

		return canCommit(offer.weight, offer.reps)
			? { weight: offer.weight as number, reps: offer.reps as number }
			: null;
	}

	function rowWord(cursor: SetCursor): string | null {
		const active = cursor.set.id === activeSetId;

		if (cursor.set.completed) {
			return active
				? 'Editing'
				: (exertionLabel(cursor.set.rpe, exertionScale.current) ?? 'Logged');
		}

		return active ? 'Now' : null;
	}

	function rowRight(cursor: SetCursor, leg: Group): string | null {
		const parts = [setNote(leg.meta, leg.grip, cursor.set), rowWord(cursor)].filter(Boolean);

		return parts.length === 0 ? null : parts.join(' · ');
	}

	// Where a new round starts, the rows part a little further: A1 B1 read as one pair.
	function opensRound(at: number): boolean {
		if (!superset || at === 0) {
			return false;
		}

		return cursors[at].workingIndex !== cursors[at - 1].workingIndex;
	}

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const grow = $derived(mounted ? smallMs() : 0);

	const heading =
		'flex min-h-11 min-w-0 press-sink items-baseline gap-2 rounded-xl px-1 py-2 text-left ' +
		'focus-ring hover:bg-hover press:bg-surface-2';
</script>

<section data-exercise class="flex flex-col gap-1">
	<!-- The heading is the whole control now. A ⋮ on every exercise put four of them on a
	     phone screen for one act apiece, so the act moved onto the thing it acts on: tapping
	     the name opens the exercise's sheet, and the page it used to link to is the first row
	     inside that sheet. A superset's names are one such control each. -->
	<div data-exercise-head class="flex scroll-mt-3 items-center gap-1">
		{#if superset}
			<!-- Wrapping, not truncating: three legs on a phone cut every name to a stub, and a
			     second line of whole names is cheaper than a heading nobody can read. -->
			<h2 class="flex min-w-0 flex-1 flex-wrap items-baseline">
				<span class="shrink-0 pr-1.5 pl-1 label-caps text-accent-text">Superset</span>

				{#each legs as leg, at (leg.id)}
					<span class="flex max-w-full min-w-0 items-baseline">
						{#if at > 0}
							<span aria-hidden="true" class="shrink-0 text-lg font-extrabold text-ink-faint">
								+
							</span>
						{/if}

						<button
							type="button"
							aria-label="{leg.meta.name} options"
							onclick={(e) => onexercise(leg.id, e.currentTarget)}
							class="{heading} gap-1.5"
							{@attach press()}
						>
							<span class="shrink-0 text-md font-extrabold text-accent-text">{legLetter(at)}</span>
							<span class="min-w-0 truncate text-lg font-extrabold tracking-tight text-ink">
								{leg.meta.name}
							</span>
							{#if leg.cursors[0]?.exercise.optional === true}
								<span class="shrink-0 self-center"><Badge>Optional</Badge></span>
							{/if}
						</button>
					</span>
				{/each}
			</h2>
		{:else}
			<h2 class="min-w-0 flex-1">
				<button
					type="button"
					aria-label="{lone.meta.name} options"
					onclick={(e) => onexercise(lone.id, e.currentTarget)}
					class="{heading} w-full"
					{@attach press()}
				>
					<span class="min-w-0 shrink truncate text-lg font-extrabold tracking-tight text-ink">
						{lone.meta.name}
					</span>
					<span class="min-w-0 shrink-[2] truncate text-sm font-bold text-ink-faint">{setup}</span>
					{#if optional}
						<span class="shrink-0 self-center"><Badge>Optional</Badge></span>
					{/if}
				</button>
			</h2>
		{/if}
	</div>

	{#each legs as leg, at (leg.id)}
		{@const last = notes[leg.meta.id]}

		{#if leg.note !== undefined}
			<p class="-mt-1 line-clamp-2 px-1 pb-1 text-sm font-bold text-ink-muted">
				{#if superset}<span class="text-accent-text">{legLetter(at)}</span>{/if}
				{leg.note}
			</p>
		{:else if last !== undefined}
			<p class="-mt-1 line-clamp-2 px-1 pb-1 text-sm font-bold text-ink-faint">
				{#if superset}<span class="text-accent-text">{legLetter(at)}</span>{/if}
				<span class="label-caps">Last time</span>
				{last}
			</p>
		{/if}
	{/each}

	<div class="list-group">
		{#each cursors as cursor, at (cursor.set.id)}
			{@const { leg, letter } = ownerOf(cursor)}
			{@const status = statusOf(cursor)}
			{@const active = cursor.set.id === activeSetId}
			{@const editing = active && cursor.set.completed}
			{@const shown = cursor.set.completed
				? { weight: cursor.set.weight, reps: cursor.set.reps }
				: offerOf(cursor)}
			<div
				transition:slide={{ duration: grow }}
				data-active-set={active ? '' : undefined}
				data-round-opens={opensRound(at) ? '' : undefined}
				class="scroll-mt-3"
				style="scroll-margin-bottom: {floor + 12}px"
			>
				<SwipeRow
					status={active && !cursor.set.completed ? 'active' : status}
					index={cursor.workingIndex + 1}
					warmup={cursor.set.type === 'warmup'}
					leg={letter}
					figures={setFigures(leg.meta, shown.weight, shown.reps)}
					selected={editing}
					right={rowRight(cursor, leg)}
					quick={quickOf(cursor)}
					onselect={() => onselect(cursor.set.id)}
					onquick={() => {
						const quick = quickOf(cursor);

						if (quick !== null) {
							onquick(cursor.set.id, quick.weight, quick.reps);
						}
					}}
					onunlog={onunlog !== undefined && cursor.set.completed
						? () => onunlog(cursor.set.id)
						: undefined}
					onremove={onremove !== undefined && leg.cursors.length > 1
						? () => onremove(cursor.set.id)
						: undefined}
					onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
				/>
			</div>
		{/each}

		<AddRow
			flush
			label={superset ? 'Add round' : 'Add set'}
			icon={RowsPlusBottom}
			onclick={onadd}
			secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
			secondaryIcon={StackPlus}
			onsecondary={oninsert}
		/>
	</div>
</section>
