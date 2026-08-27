<script lang="ts">
	import { slide } from 'svelte/transition';

	import { exertionLabel } from '$lib/domain/exertion';
	import { canCommit, prefillFor } from '$lib/domain/workout';
	import { gripLabel } from '$lib/domain/grip';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { smallMs } from '$lib/ui/motion';
	import { press } from '$lib/ui/press';
	import { openedFrom } from '$lib/nav/bar.svelte';
	import { setNote, statusOf } from '$lib/workout/groups';
	import More from '$lib/ui/icons/More.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import SwipeRow from '$lib/workout/SwipeRow.svelte';

	type Props = {
		meta: Exercise;
		grip?: string;
		cursors: SetCursor[];
		history: History;
		activeSetId: string | null;
		/** The address the exercise's own page walks back to — this screen, not the browse list. */
		from?: string;
		onselect: (setId: string) => void;
		onquick: (setId: string, weight: number, reps: number) => void;
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
		from,
		onselect,
		onquick,
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
		return prefillFor(cursor, history, meta);
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
		if (cursor.set.completed) {
			return exertionLabel(cursor.set.rpe, exertionScale.current) ?? 'Logged';
		}

		return cursor.set.id === activeSetId ? 'Now' : null;
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

<section data-exercise class="flex flex-col gap-2">
	<div data-exercise-head class="flex scroll-mt-3 items-center gap-1">
		<a
			href={openedFrom(`/plan/exercises/${meta.id}`, from)}
			class="min-w-0 flex-1 press-sink rounded-xl px-1 py-1 text-left focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press(() => onexercise)}
		>
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			<p class="truncate text-sm font-bold text-ink-faint">{setup}</p>
		</a>

		<button
			type="button"
			aria-label="Exercise options"
			onclick={(e) => onexercise(e.currentTarget)}
			class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint focus-ring
				hover:bg-sunken hover:text-ink-muted pointer-fine:transition-[background-color,color] pointer-fine:duration-100
				press:bg-sunken press:text-ink-muted"
			{@attach press()}
		>
			<More size={20} />
		</button>
	</div>

	<div class="list-group">
		{#each cursors as cursor (cursor.set.id)}
			{@const status = statusOf(cursor)}
			{@const active = cursor.set.id === activeSetId}
			{@const shown = cursor.set.completed
				? { weight: cursor.set.weight, reps: cursor.set.reps }
				: offerOf(cursor)}
			<div
				transition:slide={{ duration: grow }}
				data-active-set={active ? '' : undefined}
				class="scroll-my-3"
			>
				<SwipeRow
					status={active && !cursor.set.completed ? 'active' : status}
					index={cursor.workingIndex + 1}
					weight={shown.weight}
					reps={shown.reps}
					right={rowRight(cursor)}
					quick={quickOf(cursor)}
					onselect={cursor.set.type === 'warmup' ? undefined : () => onselect(cursor.set.id)}
					onquick={() => {
						const quick = quickOf(cursor);

						if (quick !== null) {
							onquick(cursor.set.id, quick.weight, quick.reps);
						}
					}}
					onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
				/>
			</div>
		{/each}
	</div>

	<AddRow
		label="Add set"
		icon={RowsPlusBottom}
		onclick={onadd}
		secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
		secondaryIcon={StackPlus}
		onsecondary={oninsert}
	/>
</section>
