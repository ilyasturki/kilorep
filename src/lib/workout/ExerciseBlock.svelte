<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import { exertionLabel } from '$lib/domain/exertion';
	import { hintLabel } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import AddRow from '$lib/ui/AddRow.svelte';
	import { revealNearest } from '$lib/ui/scroll';
	import SetRow from '$lib/ui/SetRow.svelte';
	import { statusOf } from '$lib/workout/groups';
	import More from '$lib/ui/icons/More.svelte';
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

	let holder = $state<HTMLElement | null>(null);

	$effect(() => {
		if (holder === null || activeSetId === null) {
			return;
		}

		revealNearest(holder);
	});

	const grow = $derived(prefersReducedMotion.current ? 0 : 200);
</script>

<section class="flex flex-col gap-2">
	<div class="flex items-center gap-1">
		<a
			href="/exercises/{meta.id}"
			oncontextmenu={(e) => {
				e.preventDefault();
				onexercise(e.currentTarget);
			}}
			class="min-w-0 flex-1 rounded-xl px-1 py-1 text-left focus-ring hover:bg-hover
				active:bg-surface-2"
		>
			<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
			<p class="truncate text-sm font-bold text-ink-faint">
				{meta.equipment}{meta.loadMode === 'per-hand' ? ' · per hand' : ''}
			</p>
		</a>

		<button
			type="button"
			aria-label="Exercise options"
			onclick={(e) => onexercise(e.currentTarget)}
			class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint focus-ring
				hover:bg-sunken hover:text-ink-muted pointer-fine:transition-[background-color,color]
				pointer-fine:duration-100"
		>
			<More size={20} />
		</button>
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{#if cursor.set.id === activeSetId}
			<div
				bind:this={holder}
				data-active-set
				transition:slide={{ duration: grow }}
				onintroend={() => holder !== null && revealNearest(holder)}
			>
				{#key cursor.set.id}
					<ActiveSet
						{cursor}
						{history}
						step={weightStep(meta.equipment)}
						{oncommit}
						ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
						onrate={(rpe) => onrate(cursor.set.id, rpe)}
						onoptions={(anchor) => onoptions(cursor.set.id, anchor)}
					/>
				{/key}
			</div>
		{:else}
			<div transition:slide={{ duration: grow }}>
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
			</div>
		{/if}
	{/each}

	<AddRow
		label="Add set"
		onclick={onadd}
		secondaryLabel={oninsert === undefined ? undefined : 'Exercise'}
		onsecondary={oninsert}
	/>
</section>
