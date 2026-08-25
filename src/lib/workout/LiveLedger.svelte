<script lang="ts">
	import {
		EXERTION_RUNGS,
		exertionLabel,
		scaleName,
		shownExertion,
		storedExertion
	} from '$lib/domain/exertion';
	import type { Exercise } from '$lib/domain/exercise';
	import { gripLabel } from '$lib/domain/grip';
	import { canCommit, hintLabel, prefillFor } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { press } from '$lib/ui/press';
	import SetMark from '$lib/ui/SetMark.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import RowsPlusBottom from '$lib/ui/icons/RowsPlusBottom.svelte';
	import StackPlus from '$lib/ui/icons/StackPlus.svelte';
	import type { Entry, Group } from '$lib/workout/groups';
	import { setNote, statusOf } from '$lib/workout/groups';

	type Props = {
		entries: Entry[];
		history: History;
		activeSetId: string | null;
		onselect: (setId: string) => void;
		onquick: (setId: string, weight: number, reps: number) => void;
		/** The selected row's check — routed through the page so update and commit split there. */
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onadd: (exerciseId: string) => void;
		oninsert: (entryId: string) => void;
		onoptions: (setId: string, anchor: HTMLElement) => void;
		onexercise: (exerciseId: string, anchor: HTMLElement) => void;
	};

	let {
		entries,
		history,
		activeSetId,
		onselect,
		onquick,
		oncommit,
		ondraft,
		onrate,
		onadd,
		oninsert,
		onoptions,
		onexercise
	}: Props = $props();

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
		if (cursor.set.completed || cursor.set.type === 'warmup') {
			return null;
		}

		const offer = offerOf(cursor, meta);

		return canCommit(offer.weight, offer.reps)
			? { weight: offer.weight as number, reps: offer.reps as number }
			: null;
	}

	function rowLabel(cursor: SetCursor, leg: Group): string {
		const name = cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`;
		const note = setNote(leg.meta, leg.grip, cursor.set);

		return note === null ? name : `${name} · ${note}`;
	}

	function lastOf(cursor: SetCursor, meta: Exercise): string {
		return hintLabel(history, cursor, meta) ?? '—';
	}

	const show = (n: number | null) => (n === null ? '–' : String(n));

	// What the sets already logged add up to. Storage is kilograms whatever the display
	// mode, so the sum is honest across exercises.
	const volume = $derived(
		Math.round(
			entries
				.flatMap((entry) => entry.cursors)
				.filter((cursor) => cursor.set.completed)
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
		const from = offer.weight ?? 0;
		const next = from + direction * weightStep(meta.equipment, from, direction);

		ondraft(Math.max(0, Math.round(next * 10) / 10), offer.reps);
	}

	function draftReps(offer: Offer, direction: number) {
		ondraft(offer.weight, Math.max(0, (offer.reps ?? 0) + direction));
	}

	const mini =
		'grid size-7 shrink-0 place-items-center rounded-lg bg-black/6 text-base font-semibold ' +
		'text-ink-muted focus-ring hover:bg-black/11 press:bg-black/11 press:text-ink ' +
		'pointer-fine:transition-[background-color] pointer-fine:duration-100';
</script>

<div class="flex flex-col gap-2.5">
	<div class="{cols} px-1">
		<span></span>
		<span class="label-caps">Set</span>
		<span class="label-caps">Last time</span>
		<span class="text-center label-caps">Load</span>
		<span class="text-center label-caps">Reps</span>
		<span class="text-center label-caps">{scaleName(scale)}</span>
		<span class="text-center label-caps">Log</span>
		<span></span>
	</div>

	<div class="flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface">
		{#each entries as entry, at (entry.id)}
			{#each entry.legs as leg (leg.id)}
				{@const setup = [leg.meta.equipment, gripLabel(leg.meta, leg.grip)]
					.filter(Boolean)
					.join(' · ')}
				{@const done = leg.cursors.filter((cursor) => cursor.set.completed).length}

				<div
					data-exercise
					class={[cols, 'min-h-11 bg-canvas', at > 0 && 'border-t border-line-soft']}
				>
					<span></span>
					<span data-exercise-head class="flex min-w-0 items-baseline gap-2 py-1">
						<a
							href="/plan/exercises/{leg.meta.id}"
							class="truncate rounded-md text-md font-extrabold tracking-tight text-ink
								focus-ring hover:underline"
						>
							{leg.meta.name}
						</a>
						<span class="truncate text-sm font-bold text-ink-faint">{setup}</span>
						{#if entry.superset}
							<span
								class="shrink-0 rounded-full bg-accent-soft px-2 text-xs font-extrabold
									text-accent-text"
							>
								Superset
							</span>
						{/if}
					</span>
					<span class="col-span-4"></span>
					<span class="text-center text-xs font-extrabold text-ink-faint">
						{done}/{leg.cursors.length}
					</span>
					<button
						type="button"
						aria-label="{leg.meta.name} options"
						onclick={(e) => onexercise(leg.id, e.currentTarget)}
						class="grid size-8 place-items-center justify-self-center rounded-lg text-ink-faint
							focus-ring hover:bg-sunken hover:text-ink-muted
							pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
					>
						<More size={18} />
					</button>
				</div>

				{#each leg.cursors as cursor (cursor.set.id)}
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

					<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
					<div
						data-active-set={selected ? '' : undefined}
						onclick={status === 'warmup' ? undefined : () => onselect(cursor.set.id)}
						class={[
							cols,
							'min-h-11 scroll-my-3 border-t border-line-soft',
							selected ? 'bg-accent-soft' : 'bg-surface',
							status !== 'warmup' && !selected && 'cursor-pointer hover:bg-hover',
							status === 'warmup' && 'opacity-[0.72]',
							'pointer-fine:transition-[background-color] pointer-fine:duration-100'
						]}
					>
						<span class="grid place-items-center">
							<SetMark status={active ? 'active' : status} index={cursor.workingIndex + 1} />
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
							<span
								class="min-w-13 text-center text-base font-extrabold tracking-numeral
									tabular-nums {numerals}"
							>
								{show(offer.weight)}
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
											'grid h-7 min-w-7 shrink-0 place-items-center rounded-lg px-1 text-xs',
											'font-extrabold tabular-nums focus-ring',
											'pointer-fine:transition-[background-color,color]',
											'pointer-fine:duration-100',
											lit
												? 'bg-accent text-on-accent'
												: 'bg-black/6 text-ink-muted hover:bg-black/11'
										]}
									>
										{shownExertion(rung, scale)}
									</button>
								{/each}
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
							onclick={() => onadd(leg.cursors[0].exercise.id)}
							class="flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-caps
								text-ink-faint uppercase focus-ring hover:text-ink-muted"
						>
							<RowsPlusBottom size={15} />
							Add set
						</button>
						{#if leg.id === entry.legs[entry.legs.length - 1].id}
							<button
								type="button"
								onclick={() => oninsert(entry.id)}
								class="flex items-center gap-1.5 rounded-md text-xs font-extrabold tracking-caps
									text-ink-faint uppercase focus-ring hover:text-ink-muted"
							>
								<StackPlus size={15} />
								Exercise
							</button>
						{/if}
					</span>
					<span></span>
				</div>
			{/each}
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
