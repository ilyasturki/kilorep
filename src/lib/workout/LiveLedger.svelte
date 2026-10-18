<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';

	import {
		EXERTION_RUNGS,
		exertionLabel,
		scaleName,
		shownExertion,
		storedExertion
	} from '$lib/domain/exertion';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { canCommit, hintLabel, prefillFor, rampFor, rampLabel } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { setFigures } from '$lib/exercises/label';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { DragOrder, SETTLE } from '$lib/ui/dragOrder.svelte';
	import { press } from '$lib/ui/press';
	import SetMark from '$lib/ui/SetMark.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import DotsSixVertical from '$lib/ui/icons/DotsSixVertical.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import { exerciseHref } from '$lib/exercises/link';
	import type { LastNotes } from '$lib/store/derive';
	import type { Entry, Group } from '$lib/workout/groups';
	import { legLetter, setNote, statusOf } from '$lib/workout/groups';

	type Props = {
		entries: Entry[];
		history: History;
		/** Last time's notes, each drawn under its exercise until this session writes its own. */
		notes?: LastNotes;
		activeSetId: string | null;
		/** The address an exercise's own page walks back to — this screen, not the browse list. */
		from?: string;
		onselect: (setId: string) => void;
		onquick: (setId: string, weight: number, reps: number) => void;
		/** The selected row's check — routed through the page, which owes rest only on a first log. */
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		/** A set, or on a superset a round: one set on every leg. */
		onadd: (entryId: string) => void;
		oninsert: (entryId: string) => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (exerciseId: string, anchor: HTMLElement) => void;
		onreorder: (entryId: string, index: number) => void;
	};

	let {
		entries,
		history,
		notes = {},
		activeSetId,
		from,
		onselect,
		onquick,
		oncommit,
		ondraft,
		onrate,
		onadd,
		oninsert,
		onoptions,
		onexercise,
		onreorder
	}: Props = $props();

	// Whole entries move — a superset travels as one block — and the grip is the only handle:
	// every other pixel of these rows already selects, steps or logs.
	const drag = new DragOrder({
		order: () => entries.map((entry) => entry.id),
		move: (id, index) => {
			onreorder(id, index);

			return true;
		}
	});

	const slide = $derived(prefersReducedMotion.current ? 0 : 200);

	const cols =
		'grid grid-cols-[3rem_minmax(0,1fr)_9rem_11rem_9rem_14rem_4rem_2.75rem] items-center';

	const scale = $derived(exertionScale.current);

	function offerOf(
		cursor: SetCursor,
		meta: Exercise
	): { weight: number | null; reps: number | null } {
		return prefillFor(cursor, history, meta);
	}

	// One gesture logs the numbers the row shows; a row with nothing to offer has no gesture.
	// The selected row's own gesture routes through `oncommit` instead, where update and
	// commit part ways — this one is for the rows the cursor is not standing on.
	function quickOf(cursor: SetCursor, meta: Exercise): { weight: number; reps: number } | null {
		if (cursor.set.completed) {
			return null;
		}

		const offer = offerOf(cursor, meta);

		return canCommit(offer.weight, offer.reps)
			? { weight: offer.weight as number, reps: offer.reps as number }
			: null;
	}

	function setupOf(leg: Group): string {
		return [leg.meta.equipment, gripLabel(leg.meta, leg.grip)].filter(Boolean).join(' · ');
	}

	function rowLabel(cursor: SetCursor, leg: Group): string {
		const warmup = cursor.workingIndex < 0;
		const name = warmup ? 'Warmup' : `Set ${cursor.workingIndex + 1}`;
		const note = setNote(leg.meta, leg.grip, cursor.set);
		// The tray says this on the phone; here the row is the only place the plan can speak.
		const target =
			warmup || cursor.set.plannedReps === null ? null : `target ${cursor.set.plannedReps}`;

		return [name, note, target].filter((part) => part !== null).join(' · ');
	}

	// A warmup recalls nothing, so its column names the rung it is offered instead.
	function lastOf(cursor: SetCursor, meta: Exercise): string {
		const ramp = cursor.set.completed ? null : rampFor(cursor, history, meta);
		const rung = ramp === null ? null : rampLabel(ramp, meta);

		return rung ?? hintLabel(history, cursor, meta) ?? '—';
	}

	const show = (n: number | null) => (n === null ? '–' : String(n));

	// What the sets already logged add up to. Storage is kilograms whatever the display
	// mode, so the sum is honest across exercises.
	const volume = $derived(
		Math.round(
			entries
				.flatMap((entry) => entry.cursors)
				.filter((cursor) => cursor.set.completed && cursor.set.type !== 'warmup')
				.reduce((sum, cursor) => sum + (cursor.set.weight ?? 0) * (cursor.set.reps ?? 0), 0)
		)
	);

	const anyLogged = $derived(
		entries.flatMap((entry) => entry.cursors).some((c) => c.set.completed)
	);

	function swallow(event: MouseEvent) {
		event.stopPropagation();
	}

	type Offer = { weight: number | null; reps: number | null };

	function draftWeight(offer: Offer, meta: Exercise, direction: number) {
		const base = offer.weight ?? 0;
		const next = base + direction * weightStep(meta.equipment, base, direction);

		ondraft(Math.max(0, Math.round(next * 10) / 10), offer.reps);
	}

	function draftReps(offer: Offer, direction: number) {
		ondraft(offer.weight, Math.max(0, (offer.reps ?? 0) + direction));
	}

	const mini =
		'grid size-8 shrink-0 place-items-center rounded-lg bg-black/8 text-lg font-semibold ' +
		'text-ink focus-ring hover:bg-black/14 press:bg-black/14 ' +
		'pointer-fine:transition-[background-color] pointer-fine:duration-100';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && drag.cancel()} />

<div class="flex flex-col gap-2.5">
	<!-- `px-px` matches the card's 1px border below, so these labels sit on the same grid
	     tracks as the columns they name. -->
	<div class="{cols} px-px">
		<span></span>
		<span class="label-caps">Set</span>
		<span class="label-caps">Last time</span>
		<span class="text-center label-caps">Load</span>
		<span class="text-center label-caps">Reps</span>
		<span class="text-center label-caps">{scaleName(scale)}</span>
		<span class="text-center label-caps">Log</span>
		<span></span>
	</div>

	<div
		bind:this={drag.root}
		class="flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface"
	>
		{#each entries as entry, at (entry.id)}
			{@const lifted = drag.isLifted(entry.id)}
			{@const lone = entry.legs[0]}
			{@const done = entry.cursors.filter((cursor) => cursor.set.completed).length}

			<!-- Two divs as in DragList, and not one: `animate:flip` runs on the Web Animations
			     API, which overrides an inline transform on the same element for the length of
			     every swap — the lifted block would glide to its slot instead of riding the
			     pointer. The outer square stays in flow as the hole; the inner one travels. -->
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
					<div
						data-exercise
						class={[cols, 'min-h-11 bg-canvas', at > 0 && 'border-t border-line-soft']}
					>
						<!-- The header's index column carries the grip: a superset travels as one block. -->
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
						<!-- The head borrows the four value columns, which hold nothing on this row:
						     penned into the name column alone, a long name and its setup line were
						     ellipsised over empty grid. A superset's names are each its leg's menu. -->
						<span
							data-exercise-head
							class={[
								'col-span-5 flex min-w-0 items-baseline gap-x-2 py-1',
								entry.superset && 'flex-wrap'
							]}
						>
							{#if entry.superset}
								<span class="shrink-0 label-caps text-accent-text">Superset</span>

								{#each entry.legs as leg, legAt (leg.id)}
									{#if legAt > 0}
										<span aria-hidden="true" class="shrink-0 text-md font-extrabold text-ink-faint">
											+
										</span>
									{/if}

									<button
										type="button"
										aria-label="{leg.meta.name} options"
										onclick={(e) => onexercise(leg.id, e.currentTarget)}
										class="-mx-1 flex min-w-0 items-baseline gap-1.5 rounded-md px-1 text-left
											focus-ring hover:bg-hover
											pointer-fine:transition-[background-color] pointer-fine:duration-100"
									>
										<span class="shrink-0 text-sm font-extrabold text-accent-text">
											{legLetter(legAt)}
										</span>
										<span class="truncate text-md font-extrabold tracking-tight text-ink">
											{leg.meta.name}
										</span>
										{#if setupOf(leg)}
											<span class="truncate text-sm font-bold text-ink-faint">{setupOf(leg)}</span>
										{/if}
									</button>
								{/each}
							{:else}
								<a
									href={exerciseHref(lone.meta.id, lone.grip, from)}
									class="truncate rounded-md text-md font-extrabold tracking-tight text-ink
										focus-ring hover:underline"
								>
									{lone.meta.name}
								</a>
								<span class="truncate text-sm font-bold text-ink-faint">{setupOf(lone)}</span>
								{#if lone.cursors[0]?.exercise.optional === true}
									<span
										class="shrink-0 rounded-full bg-surface-2 px-2 text-xs font-extrabold
											text-ink-muted"
									>
										Optional
									</span>
								{/if}
							{/if}
						</span>
						<span class="text-center text-xs font-extrabold text-ink-faint">
							{done}/{entry.cursors.length}
						</span>
						{#if entry.superset}
							<span></span>
						{:else}
							<button
								type="button"
								aria-label="{lone.meta.name} options"
								onclick={(e) => onexercise(lone.id, e.currentTarget)}
								class="grid size-8 place-items-center justify-self-center rounded-lg text-ink-faint
									focus-ring hover:bg-sunken hover:text-ink-muted
									pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
							>
								<More size={18} />
							</button>
						{/if}
					</div>

					{#each entry.legs as leg, legAt (leg.id)}
						{@const last = notes[leg.meta.id]}

						{#if leg.note !== undefined || last !== undefined}
							<div class={[cols, 'bg-canvas pb-1.5']}>
								<span></span>
								<p
									class={[
										'col-span-6 -mt-1 line-clamp-2 text-sm font-bold',
										leg.note === undefined ? 'text-ink-faint' : 'text-ink-muted'
									]}
								>
									{#if entry.superset}
										<span class="text-accent-text">{legLetter(legAt)}</span>
									{/if}
									{#if leg.note === undefined}
										<span class="label-caps">Last time</span>
									{/if}
									{leg.note ?? last}
								</p>
							</div>
						{/if}
					{/each}

					{#each entry.cursors as cursor, row (cursor.set.id)}
						{@const legAt = entry.legs.findIndex((leg) => leg.id === cursor.exercise.id)}
						{@const leg = entry.legs[legAt]}
						{@const status = statusOf(cursor)}
						{@const selected = cursor.set.id === activeSetId}
						{@const active = selected && !cursor.set.completed}
						{@const offer =
							cursor.set.completed && !selected
								? { weight: cursor.set.weight, reps: cursor.set.reps }
								: offerOf(cursor, leg.meta)}
						{@const quick = quickOf(cursor, leg.meta)}
						{@const numerals = active
							? 'text-accent-text'
							: cursor.set.completed
								? 'text-ink'
								: 'text-ink-faint'}
						{@const shownRpe = exertionLabel(cursor.set.rpe, scale)}
						{@const load =
							setFigures(leg.meta, offer.weight, offer.reps).load ??
							(selected ? show(offer.weight) : null)}

						<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
						<div
							data-active-set={selected ? '' : undefined}
							onclick={() => onselect(cursor.set.id)}
							class={[
								cols,
								'min-h-11 scroll-my-3',
								entry.superset &&
								row > 0 &&
								cursor.workingIndex !== entry.cursors[row - 1].workingIndex
									? 'border-t-4 border-canvas'
									: 'border-t border-line-soft',
								selected ? 'bg-accent-soft' : 'bg-surface',
								!selected && 'hover:bg-hover press:bg-surface-2',
								status === 'warmup' && !selected && 'opacity-[0.72]',
								'pointer-fine:transition-[background-color] pointer-fine:duration-100'
							]}
							{@attach press()}
						>
							<span class="grid place-items-center">
								<SetMark
									status={active ? 'active' : status}
									index={cursor.workingIndex + 1}
									warmup={cursor.set.type === 'warmup'}
									leg={entry.superset ? legLetter(legAt) : undefined}
									contrast={selected}
								/>
							</span>

							<span
								class={[
									'truncate py-1 pr-2 text-md font-bold',
									selected ? 'text-accent-text' : 'text-ink-muted'
								]}
							>
								{rowLabel(cursor, leg)}
							</span>

							<span class="truncate text-md font-bold text-ink-faint tabular-nums">
								{lastOf(cursor, leg.meta)}
							</span>

							<span class="flex items-center justify-center gap-1.5">
								{#if selected}
									<button
										type="button"
										aria-label="Lower weight"
										onclick={(e) => {
											swallow(e);
											draftWeight(offer, leg.meta, -1);
										}}
										class={mini}
										{@attach press()}
									>
										−
									</button>
								{/if}
								<span class="flex items-baseline">
									<span
										class="min-w-13 text-right text-base font-extrabold tracking-numeral
										tabular-nums {numerals}"
									>
										{load ?? ''}
									</span>
									<span class="w-6 pl-1 text-sm font-bold text-ink-faint">
										{load === null ? '' : 'kg'}
									</span>
								</span>
								{#if selected}
									<button
										type="button"
										aria-label="Raise weight"
										onclick={(e) => {
											swallow(e);
											draftWeight(offer, leg.meta, 1);
										}}
										class={mini}
										{@attach press()}
									>
										+
									</button>
								{/if}
							</span>

							<span class="flex items-center justify-center gap-1.5">
								{#if selected}
									<button
										type="button"
										aria-label="Lower reps"
										onclick={(e) => {
											swallow(e);
											draftReps(offer, -1);
										}}
										class={mini}
										{@attach press()}
									>
										−
									</button>
								{/if}
								<span
									class="min-w-9 text-center text-base font-extrabold tracking-numeral
									tabular-nums {numerals}"
								>
									{show(offer.reps)}
								</span>
								{#if selected}
									<button
										type="button"
										aria-label="Raise reps"
										onclick={(e) => {
											swallow(e);
											draftReps(offer, 1);
										}}
										class={mini}
										{@attach press()}
									>
										+
									</button>
								{/if}
							</span>

							<span class="flex items-center justify-center gap-1">
								{#if selected}
									{#each EXERTION_RUNGS as rung (rung)}
										{@const lit = cursor.set.rpe === rung}
										<button
											type="button"
											aria-label="{scaleName(scale)} {shownExertion(rung, scale)}"
											aria-pressed={lit}
											onclick={(e) => {
												swallow(e);
												onrate(lit ? null : storedExertion(shownExertion(rung, scale), scale));
											}}
											class={[
												'grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1 text-sm',
												'font-extrabold tabular-nums focus-ring',
												'pointer-fine:transition-[background-color,color]',
												'pointer-fine:duration-100',
												lit ? 'bg-accent text-on-accent' : 'bg-black/8 text-ink hover:bg-black/14'
											]}
										>
											{shownExertion(rung, scale)}
										</button>
									{/each}
									{#if cursor.set.rpe !== null && !EXERTION_RUNGS.includes(cursor.set.rpe)}
										<!-- A custom rating lands between the rungs, and a value no chip
									     carries would otherwise vanish the moment it was set. Lit
									     like a rung and cleared like one. -->
										<button
											type="button"
											aria-label="{scaleName(scale)} {shownExertion(cursor.set.rpe, scale)}"
											aria-pressed={true}
											onclick={(e) => {
												swallow(e);
												onrate(null);
											}}
											class="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg
											bg-accent px-1 text-sm font-extrabold text-on-accent tabular-nums
											focus-ring"
										>
											{shownExertion(cursor.set.rpe, scale)}
										</button>
									{/if}
								{:else if cursor.set.completed}
									<span class="text-md font-extrabold text-ink-faint tabular-nums">
										{shownRpe === null ? '—' : shownExertion(cursor.set.rpe as number, scale)}
									</span>
								{/if}
							</span>

							<span class="grid place-items-center">
								{#if selected && cursor.set.completed}
									{#if canCommit(offer.weight, offer.reps)}
										<button
											type="button"
											aria-label="Update set to {offer.weight} × {offer.reps}"
											onclick={(e) => {
												swallow(e);
												oncommit(offer.weight as number, offer.reps as number);
											}}
											class="grid size-8 place-items-center rounded-full bg-accent
											text-on-accent focus-ring hover:bg-accent-hover"
											{@attach press()}
										>
											<Check size={16} />
										</button>
									{/if}
								{:else if selected && canCommit(offer.weight, offer.reps)}
									<button
										type="button"
										aria-label="Log {offer.weight} × {offer.reps}"
										onclick={(e) => {
											swallow(e);
											oncommit(offer.weight as number, offer.reps as number);
										}}
										class="grid size-8 place-items-center rounded-full border-[1.5px] border-dashed
										border-accent bg-surface text-accent-text focus-ring hover:bg-hover"
										{@attach press()}
									>
										<Check size={15} />
									</button>
								{:else if quick !== null}
									<button
										type="button"
										aria-label="Log {quick.weight} × {quick.reps} as planned"
										onclick={(e) => {
											swallow(e);
											onquick(cursor.set.id, quick.weight, quick.reps);
										}}
										class="grid size-8 place-items-center rounded-full border-[1.5px] border-dashed
										border-accent text-accent-text focus-ring hover:bg-hover"
										{@attach press()}
									>
										<Check size={15} />
									</button>
								{/if}
							</span>

							<button
								type="button"
								aria-label="Set options"
								onclick={(e) => {
									swallow(e);
									onoptions(cursor.set.id, e.currentTarget);
								}}
								class="grid size-8 place-items-center justify-self-center rounded-lg text-ink-faint
								focus-ring hover:bg-black/6 hover:text-ink-muted
								pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
							>
								<More size={18} />
							</button>
						</div>
					{/each}

					<div class={[cols, 'min-h-9 border-t border-line-soft bg-surface']}>
						<span></span>
						<span class="col-span-6 flex items-center gap-4 py-1">
							<button
								type="button"
								onclick={() => onadd(entry.id)}
								class="flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-caps
								text-ink-faint uppercase focus-ring hover:text-ink-muted"
							>
								<RowsPlusBottom size={15} />
								{entry.superset ? 'Add round' : 'Add set'}
							</button>
							<button
								type="button"
								onclick={() => oninsert(entry.id)}
								class="flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-caps
								text-ink-faint uppercase focus-ring hover:text-ink-muted"
							>
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

	<div class="flex items-center justify-between px-1">
		<span class="text-sm font-bold text-ink-faint">
			<kbd class="rounded-md border border-b-2 border-line bg-surface px-1.5 font-sans font-bold">
				↵
			</kbd>
			logs the highlighted set
		</span>
		{#if anyLogged}
			<span class="text-sm font-extrabold text-ink-faint tabular-nums">
				{volume.toLocaleString('en-US')} kg lifted so far
			</span>
		{/if}
	</div>
</div>
