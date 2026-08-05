<script lang="ts">
	import { slide } from 'svelte/transition';

	import { exertionLabel } from '$lib/domain/exertion';
	import { hintLabel } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { loadUnitLabel } from '$lib/exercises/label';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { captureMorph } from '$lib/ui/morph';
	import { quickMs } from '$lib/ui/motion';
	import { press } from '$lib/ui/press';
	import SetRow from '$lib/ui/SetRow.svelte';
	import { statusOf } from '$lib/workout/groups';
	import More from '$lib/ui/icons/More.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';

	type Props = {
		meta: Exercise;
		cursors: SetCursor[];
		history: History;
		activeSetId: string | null;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (setId: string, weight: number | null, reps: number | null) => void;
		onrate: (setId: string, rpe: number | null) => void;
		onselect: (setId: string) => void;
		onadd: () => void;
		oninsert?: () => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (anchor: HTMLElement) => void;
	};

	let {
		meta,
		cursors,
		history,
		activeSetId,
		oncommit,
		ondraft,
		onrate,
		onselect,
		onadd,
		oninsert,
		onoptions,
		onexercise
	}: Props = $props();

	function rowHint(cursor: SetCursor): string | null {
		if (cursor.set.weight !== null || cursor.set.reps !== null || cursor.set.type === 'warmup') {
			return null;
		}

		return hintLabel(history, cursor, exertionScale.current);
	}

	function rowRight(cursor: SetCursor): string {
		return rowHint(cursor) ?? exertionLabel(cursor.set.rpe, exertionScale.current) ?? '';
	}

	/**
	 * A set that arrives or leaves slides — `slide` doing the only job it was
	 * ever right for here: an `Add set` that grows a row into place, a removal
	 * that closes the gap behind it.
	 *
	 * It is not what moves a set taking focus, and it never could be. The row and
	 * the editor were two branches of an `{#if}` and each carried its own
	 * `slide`, so focusing a set played two of them against each other — the old
	 * card collapsing while the new one grew, both in the document at once — and
	 * the block's height swelled and settled back on every tap. The wrapper below
	 * is one element per set for the life of that set, which is what makes the
	 * swap inside it a single reflow; `morph.ts` animates that one element's
	 * height across it, from what it measured to what it lands on.
	 *
	 * Zero until the block has mounted, which is what keeps a session from
	 * accordioning open on arrival. Svelte plays intro transitions for elements
	 * created by an update, and a navigation into this screen is an update — so
	 * every row in a twelve-set session used to slide in behind the pane's jump
	 * to the live set. The flag is read when each transition starts, so the
	 * mounting pass gets a duration of 0 and every set added afterwards gets the
	 * full one.
	 */
	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const grow = $derived(mounted ? quickMs() : 0);

	/**
	 * Every set's wrapper, by set id, so the two the cursor is moving between can
	 * be measured. A plain `Map` and not `$state`: it is written by attachments
	 * during the update and read by the effect below, and a reactive one would
	 * make each row's mount a dependency of that effect.
	 */
	const wrappers = new Map<string, HTMLElement>();

	function tracked(setId: string) {
		return (node: HTMLElement) => {
			wrappers.set(setId, node);

			return () => {
				wrappers.delete(setId);
			};
		};
	}

	function wrapperOf(setId: string | null): HTMLElement | undefined {
		return setId === null ? undefined : wrappers.get(setId);
	}

	/**
	 * The cursor is about to move, and the two boxes whose contents are about to
	 * change have to be measured while they still hold the old ones.
	 *
	 * `$effect.pre` is the only hook that runs there — before Svelte updates the
	 * DOM, with the leaving editor still at editor height and the arriving row
	 * still one line tall. Both are captured, and the screen plays them once it
	 * has decided where the pane is scrolling to; see `morph.ts`.
	 *
	 * `focused` mirrors the prop as an ordinary variable so the guard can tell a
	 * real move from any other reason this effect re-ran. Every block runs this
	 * and only the one holding each id captures anything, which is exactly right
	 * for a move that crosses from one exercise into the next.
	 */
	// svelte-ignore state_referenced_locally
	let focused = activeSetId;

	$effect.pre(() => {
		const next = activeSetId;

		if (next === focused) {
			return;
		}

		captureMorph(wrapperOf(focused));
		captureMorph(wrapperOf(next));

		focused = next;
	});
</script>

<section data-exercise class="flex flex-col gap-2">
	<!-- `scroll-mt-3` is this header's own strip of air, spent when the session
	     list jumps to this exercise and the pane puts the title at its top edge —
	     `scrollIntoView` aligns to the scrollport, which is inside the pane's own
	     `py-3`, so without it the name would sit flush against the chrome. The
	     active card's `scroll-mb-3` is the same 12px at the other end. -->
	<div data-exercise-head class="flex scroll-mt-3 items-center gap-1">
		<a
			href="/exercises/{meta.id}"
			class="min-w-0 flex-1 press-sink rounded-xl px-1 py-1 text-left focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press(() => onexercise)}
		>
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			<!-- Equipment alone. The load mode used to ride here as `· per hand`,
			     which put it two lines above the box it is a rule about; it is the
			     weight field's label now — see `loadUnitLabel`. -->
			<p class="truncate text-sm font-bold text-ink-faint">{meta.equipment}</p>
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

	{#each cursors as cursor (cursor.set.id)}
		<div transition:slide={{ duration: grow }} {@attach tracked(cursor.set.id)}>
			{#if cursor.set.id === activeSetId}
				<!-- The screen's reveals aim at this holder, so the strip of air the
				     live card keeps at the pane's floor has to be declared on it too:
				     `scroll-margin` is read off the element the scroll was asked for,
				     and the card's own `scroll-mb-3` answers only for the reveal that
				     names the card — the one a focused input triggers. -->
				<div data-active-set class="scroll-mb-3">
					<ActiveSet
						{cursor}
						{history}
						step={weightStep(meta.equipment)}
						unit={loadUnitLabel(meta.loadMode)}
						{oncommit}
						ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
						onrate={(rpe) => onrate(cursor.set.id, rpe)}
						onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
					/>
				</div>
			{:else}
				<SetRow
					status={statusOf(cursor)}
					index={cursor.workingIndex + 1}
					weight={cursor.set.weight}
					reps={cursor.set.reps}
					onselect={cursor.set.type === 'warmup' ? undefined : () => onselect(cursor.set.id)}
					onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
				>
					{#snippet right()}
						{rowRight(cursor)}
					{/snippet}
				</SetRow>
			{/if}
		</div>
	{/each}

	<!-- Two acts, two marks: a row appended under the rows above it, and an
	     exercise joining the stack the session is. A plus on both halves was one
	     mark drawn twice, and left `set` and `Exercise` to say the whole
	     difference between them. -->
	<AddRow
		label="Add set"
		icon={RowsPlusBottom}
		onclick={onadd}
		secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
		secondaryIcon={StackPlus}
		onsecondary={oninsert}
	/>
</section>
