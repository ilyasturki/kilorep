<script lang="ts">
	import { slide } from 'svelte/transition';

	import { exertionLabel } from '$lib/domain/exertion';
	import { canCommit, prefillFor } from '$lib/domain/workout';
	import { gripLabel } from '$lib/domain/grip';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { setFigures } from '$lib/exercises/label';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { smallMs } from '$lib/ui/motion';
	import { press } from '$lib/ui/press';
	import { setNote, statusOf } from '$lib/workout/groups';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import SwipeRow from '$lib/workout/SwipeRow.svelte';

	type Props = {
		meta: Exercise;
		grip?: string;
		cursors: SetCursor[];
		history: History;
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
		onadd: () => void;
		oninsert?: () => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (anchor: HTMLElement) => void;
	};

	let {
		meta,
		grip,
		cursors,
		history,
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

	// The equipment line already carries a word about the setup, so the grip joins it there
	// rather than taking a row of its own: it is read on the way past, and changed by a press
	// on the same heading, which is where the options for this exercise already live.
	const setup = $derived([meta.equipment, gripLabel(meta, grip)].filter(Boolean).join(' · '));

	function offerOf(cursor: SetCursor): { weight: number | null; reps: number | null } {
		return prefillFor(cursor, history);
	}

	// One gesture logs the numbers the row shows; a row with nothing to offer has no gesture.
	function quickOf(cursor: SetCursor): { weight: number; reps: number } | null {
		if (cursor.set.completed || cursor.set.type === 'warmup') {
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

	function rowRight(cursor: SetCursor): string | null {
		const parts = [setNote(meta, grip, cursor.set), rowWord(cursor)].filter(Boolean);

		return parts.length === 0 ? null : parts.join(' · ');
	}

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const grow = $derived(mounted ? smallMs() : 0);
</script>

<section data-exercise class="flex flex-col gap-1">
	<!-- The heading is the whole control now. A ⋮ on every exercise put four of them on a
	     phone screen for one act apiece, so the act moved onto the thing it acts on: tapping
	     the name opens the exercise's sheet, and the page it used to link to is the first row
	     inside that sheet. -->
	<div data-exercise-head class="flex scroll-mt-3 items-center gap-1">
		<h2 class="min-w-0 flex-1">
			<button
				type="button"
				aria-label="{meta.name} options"
				onclick={(e) => onexercise(e.currentTarget)}
				class="flex min-h-11 w-full press-sink items-baseline gap-2 rounded-xl px-1 py-2 text-left
					focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<span class="min-w-0 shrink truncate text-lg font-extrabold tracking-tight text-ink">
					{meta.name}
				</span>
				<span class="min-w-0 shrink-[2] truncate text-sm font-bold text-ink-faint">{setup}</span>
			</button>
		</h2>
	</div>

	<div class="list-group">
		{#each cursors as cursor (cursor.set.id)}
			{@const status = statusOf(cursor)}
			{@const active = cursor.set.id === activeSetId}
			{@const editing = active && cursor.set.completed}
			{@const shown = cursor.set.completed
				? { weight: cursor.set.weight, reps: cursor.set.reps }
				: offerOf(cursor)}
			<div
				transition:slide={{ duration: grow }}
				data-active-set={active ? '' : undefined}
				class="scroll-mt-3"
				style="scroll-margin-bottom: {floor + 12}px"
			>
				<SwipeRow
					status={active && !cursor.set.completed ? 'active' : status}
					index={cursor.workingIndex + 1}
					figures={setFigures(meta, shown.weight, shown.reps)}
					selected={editing}
					right={rowRight(cursor)}
					quick={quickOf(cursor)}
					onselect={cursor.set.type === 'warmup' ? undefined : () => onselect(cursor.set.id)}
					onquick={() => {
						const quick = quickOf(cursor);

						if (quick !== null) {
							onquick(cursor.set.id, quick.weight, quick.reps);
						}
					}}
					onunlog={onunlog !== undefined && cursor.set.completed
						? () => onunlog(cursor.set.id)
						: undefined}
					onremove={onremove !== undefined && cursors.length > 1
						? () => onremove(cursor.set.id)
						: undefined}
					onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
				/>
			</div>
		{/each}

		<AddRow
			flush
			label="Add set"
			icon={RowsPlusBottom}
			onclick={onadd}
			secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
			secondaryIcon={StackPlus}
			onsecondary={oninsert}
		/>
	</div>
</section>
