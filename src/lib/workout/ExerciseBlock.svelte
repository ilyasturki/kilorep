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

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const grow = $derived(mounted ? quickMs() : 0);

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
	<div data-exercise-head class="flex scroll-mt-3 items-center gap-1">
		<a
			href="/exercises/{meta.id}"
			class="min-w-0 flex-1 press-sink rounded-xl px-1 py-1 text-left focus-ring
				hover:bg-hover press:bg-surface-2"
			{@attach press(() => onexercise)}
		>
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
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
				<div data-active-set class="scroll-mb-3">
					<ActiveSet
						{cursor}
						{history}
						step={(from, direction) => weightStep(meta.equipment, from, direction)}
						unit={loadUnitLabel(meta)}
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

	<AddRow
		label="Add set"
		icon={RowsPlusBottom}
		onclick={onadd}
		secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
		secondaryIcon={StackPlus}
		onsecondary={oninsert}
	/>
</section>
