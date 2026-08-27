<script lang="ts" module>
	// The head row and the set rows share it, so a plan and the session it becomes read as
	// one system.
	const cols = 'grid grid-cols-[3rem_minmax(0,1fr)_9rem_7rem_10rem_2.75rem] items-center';

	// LiveLedger's inline arm at StepperField's colours. Not the 76px field: that one is a
	// thumb's control and stays on the phone, where the ruler backs it. `bg-sunken` rather
	// than LiveLedger's `black/6`, because there the arms only ever draw on the selected row's
	// accent-soft ground — here they sit on canvas and surface, where a black tint disappears
	// in the dark theme. Sunken is the well every stepper in the app already stands in.
	const mini =
		'grid size-7 shrink-0 place-items-center rounded-lg bg-sunken text-base font-semibold ' +
		'text-ink-muted focus-ring hover:bg-surface-2 hover:text-ink press:bg-surface-2 ' +
		'press:text-ink disabled:opacity-40 ' +
		'pointer-fine:transition-[background-color,color] pointer-fine:duration-100';

	const foot =
		'flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-caps text-ink-faint ' +
		'uppercase focus-ring hover:text-ink-muted';
</script>

<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';

	import { gripLabel } from '$lib/domain/grip';
	import {
		MAX_REST_SECONDS,
		REST_STEP_SECONDS,
		restLabel,
		restSecondsOf,
		settleRestSeconds
	} from '$lib/domain/rest';
	import { MAX_PLANNED_SETS, PLANNED_REPS } from '$lib/domain/template';
	import { loadModeNote } from '$lib/exercises/label';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { planShape } from '$lib/templates/plan';
	import type { Planned, PlannedEntry } from '$lib/templates/plan';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		entries: PlannedEntry[];
		onoptions: (exerciseId: string, anchor: HTMLElement) => void;
		onsets: (exerciseId: string, count: number) => void;
		onreps: (exerciseId: string, reps: number | null) => void;
		onsetreps: (setId: string, reps: number | null) => void;
		onrest: (exerciseId: string, seconds: number | null | undefined) => void;
		oninsert: (entryId: string) => void;
		onreorder: (entryId: string, index: number) => boolean;
	};

	let { entries, onoptions, onsets, onreps, onsetreps, onrest, oninsert, onreorder }: Props =
		$props();

	// Whole entries move — a superset travels as one block — and the grip is the only handle:
	// every other pixel of these rows steps a number.
	const drag = new DragOrder({
		order: () => entries.map((entry) => entry.id),
		move: (id, index) => onreorder(id, index)
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	// A ramp draws its own rows because the shared field cannot say 8/6/6. Everything else is
	// one row per exercise — until someone opens it to *make* a ramp, which is the only way
	// per-set targets can be reached once they are no longer behind a caret on every card.
	let opened = $state<string[]>([]);

	function toggle(exerciseId: string) {
		opened = opened.includes(exerciseId)
			? opened.filter((id) => id !== exerciseId)
			: [...opened, exerciseId];
	}

	// Either arm wakes a plan that rests for nothing onto the default, the way a seeded
	// StepperField wakes onto its seed — stepping down from "off" has nowhere to start.
	function nudgeRest(leg: Planned, direction: number) {
		const seconds = restSecondsOf(leg.exercise, restSettings.current);
		const next =
			seconds === null ? restSettings.current.seconds : seconds + direction * REST_STEP_SECONDS;

		onrest(leg.id, settleRestSeconds(next));
	}

	const stepReps = (reps: number | null, direction: number) =>
		reps === null ? PLANNED_REPS : Math.max(1, reps + direction);

	function setupOf(leg: Planned): string {
		return [loadModeNote(leg.meta.loadMode), gripLabel(leg.meta, leg.exercise.grip)]
			.filter(Boolean)
			.join(' · ');
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

{#snippet arm(glyph: string, label: string, onclick: () => void, off = false)}
	<button type="button" aria-label={label} {onclick} disabled={off} class={mini} {@attach press()}>
		{glyph}
	</button>
{/snippet}

<div class="flex flex-col gap-2.5">
	<!-- `px-px` matches the card's 1px border below, so these labels sit on the same grid
	     tracks as the columns they name. -->
	<div class="{cols} px-px">
		<span></span>
		<span class="label-caps">Exercise</span>
		<span class="text-center label-caps">Rest</span>
		<span class="text-center label-caps">Sets</span>
		<span class="text-center label-caps">Target</span>
		<span></span>
	</div>

	<div
		bind:this={drag.root}
		class="flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface"
	>
		{#each entries as entry, at (entry.id)}
			{@const lifted = drag.isLifted(entry.id)}

			<!-- Two divs as in LiveLedger, and not one: `animate:flip` runs on the Web Animations
			     API, which overrides an inline transform on the same element for the length of
			     every swap. The outer square stays in flow as the hole; the inner one travels. -->
			<div
				data-drag-id={entry.id}
				animate:flip={{ duration: slide }}
				class={lifted ? 'relative z-10 bg-sunken' : ''}
			>
				<div
					style:transform={lifted ? `translateY(${drag.offset}px)` : null}
					style:transition={drag.settlingId === entry.id && slide > 0 ? SETTLE : null}
					class={['flex flex-col', lifted && 'bg-surface shadow-lg']}
				>
					{#each entry.legs as leg (leg.id)}
						{@const shape = planShape(leg.exercise)}
						{@const ramp = shape.kind === 'range' || shape.kind === 'mixed'}
						{@const shown = ramp || opened.includes(leg.id)}
						{@const setup = setupOf(leg)}
						{@const seconds = restSecondsOf(leg.exercise, restSettings.current)}

						<div class={[cols, 'min-h-11 bg-canvas', at > 0 && 'border-t border-line-soft']}>
							{#if leg.id === entry.legs[0].id}
								<span
									role="presentation"
									aria-hidden="true"
									onpointerdown={(e) => drag.handleDown(e, entry.id)}
									onpointermove={(e) => drag.move(e)}
									onpointerup={(e) => drag.up(e)}
									onpointercancel={(e) => drag.up(e)}
									class="grid h-full cursor-grab touch-none place-items-center
										text-ink-faint select-none"
								>
									<DotsSixVertical size={18} />
								</span>
							{:else}
								<span></span>
							{/if}

							<span class="flex min-w-0 items-baseline gap-2 py-1 pr-3">
								<a
									href="/plan/exercises/{leg.meta.id}"
									class="truncate rounded-md text-md font-extrabold tracking-tight text-ink
										focus-ring hover:underline"
								>
									{leg.meta.name}
								</a>

								{#if setup}
									<span class="truncate text-sm font-bold text-ink-faint">{setup}</span>
								{/if}

								{#if entry.superset}
									<span
										class="shrink-0 rounded-full bg-accent-soft px-2 text-xs font-extrabold
											text-accent-text"
									>
										Superset
									</span>
								{/if}
							</span>

							<!-- An inherited duration draws faint, one the plan states for itself in
							     ink — so which exercises the plan has an opinion about is legible
							     without opening anything. -->
							<span class="flex items-center justify-center gap-1.5">
								{#if restSettings.current.enabled}
									{@render arm('−', `Shorten rest after ${leg.meta.name}`, () =>
										nudgeRest(leg, -1)
									)}
									<span
										class={[
											'min-w-11 text-center text-base font-extrabold tracking-numeral tabular-nums',
											seconds === null || leg.exercise.restSeconds === undefined
												? 'text-ink-faint'
												: 'text-ink'
										]}
									>
										{seconds === null ? 'Off' : restLabel(seconds * 1000)}
									</span>
									{@render arm(
										'+',
										`Lengthen rest after ${leg.meta.name}`,
										() => nudgeRest(leg, 1),
										seconds !== null && seconds >= MAX_REST_SECONDS
									)}
								{:else}
									<span class="text-base font-extrabold text-ink-faint">—</span>
								{/if}
							</span>

							<span class="flex items-center justify-center gap-1.5">
								{@render arm(
									'−',
									`One set fewer of ${leg.meta.name}`,
									() => onsets(leg.id, shape.sets - 1),
									shape.sets <= 1
								)}
								<span
									class="min-w-6 text-center text-base font-extrabold tracking-numeral text-ink
										tabular-nums"
								>
									{shape.sets}
								</span>
								{@render arm(
									'+',
									`One set more of ${leg.meta.name}`,
									() => onsets(leg.id, shape.sets + 1),
									shape.sets >= MAX_PLANNED_SETS
								)}
							</span>

							<!-- Either arm settles every set on one target, which is also the way back
							     out of a ramp. -->
							<span class="flex items-center justify-center gap-1.5">
								{@render arm('−', `Lower the rep target for ${leg.meta.name}`, () =>
									onreps(leg.id, stepReps(shape.reps, -1))
								)}
								<span
									class={[
										'min-w-6 text-center text-base font-extrabold tracking-numeral tabular-nums',
										shape.kind === 'fixed' ? 'text-ink' : 'text-ink-faint'
									]}
								>
									{shape.kind === 'fixed' ? shape.reps : ramp ? '—' : '–'}
								</span>
								{@render arm('+', `Raise the rep target for ${leg.meta.name}`, () =>
									onreps(leg.id, stepReps(shape.reps, 1))
								)}

								{#if shape.sets > 1 && !ramp}
									<button
										type="button"
										aria-expanded={shown}
										aria-label="Per-set rep targets for {leg.meta.name}"
										onclick={() => toggle(leg.id)}
										class="grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint
											focus-ring hover:bg-sunken hover:text-ink-muted"
									>
										<CaretDown size={14} class={shown ? 'rotate-180' : ''} />
									</button>
								{:else}
									<span class="size-7 shrink-0"></span>
								{/if}
							</span>

							<button
								type="button"
								aria-label="{leg.meta.name} options"
								onclick={(e) => onoptions(leg.id, e.currentTarget)}
								class="grid size-8 place-items-center justify-self-center rounded-lg text-ink-faint
									focus-ring hover:bg-sunken hover:text-ink-muted
									pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
							>
								<More size={18} />
							</button>
						</div>

						{#if shown}
							{#each leg.exercise.sets as set, index (set.id)}
								<div class={[cols, 'min-h-11 border-t border-line-soft bg-surface']}>
									<span class="grid place-items-center">
										<span
											aria-hidden="true"
											class="grid size-8 shrink-0 place-items-center rounded-full border-[1.5px]
												border-line text-md font-extrabold text-ink-faint"
										>
											{index + 1}
										</span>
									</span>

									<span class="truncate py-1 pr-2 text-md font-bold text-ink-muted">
										Set {index + 1}
									</span>

									<span></span>
									<span></span>

									<span class="flex items-center justify-center gap-1.5">
										{@render arm(
											'−',
											`Lower the target for set ${index + 1} of ${leg.meta.name}`,
											() => onsetreps(set.id, stepReps(set.plannedReps, -1))
										)}
										<span
											class={[
												'min-w-6 text-center text-base font-extrabold tracking-numeral tabular-nums',
												set.plannedReps === null ? 'text-ink-faint' : 'text-ink'
											]}
										>
											{set.plannedReps ?? '–'}
										</span>
										{@render arm(
											'+',
											`Raise the target for set ${index + 1} of ${leg.meta.name}`,
											() => onsetreps(set.id, stepReps(set.plannedReps, 1))
										)}
										<span class="size-7 shrink-0"></span>
									</span>

									<span></span>
								</div>
							{/each}
						{/if}
					{/each}

					<div class={[cols, 'min-h-9 border-t border-line-soft bg-surface']}>
						<span></span>
						<span class="col-span-4 flex items-center py-1">
							<button type="button" onclick={() => oninsert(entry.id)} class={foot}>
								<StackPlus size={15} />
								Exercise
							</button>
						</span>
						<span></span>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
