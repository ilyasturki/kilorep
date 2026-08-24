<script lang="ts">
	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import { prefillFor } from '$lib/domain/workout';
	import { weightStep } from '$lib/domain/exercise';
	import { loadUnitLabel } from '$lib/exercises/label';
	import type { Exercise } from '$lib/domain/exercise';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { press } from '$lib/ui/press';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import ActiveSet from '$lib/workout/ActiveSet.svelte';
	import { restTimer } from '$lib/workout/rest.svelte';

	type Props = {
		cursor: SetCursor | null;
		meta: Exercise | undefined;
		note: string | null;
		count: number;
		history: History;
		/** Sets in the whole session — what the finish panel counts. */
		total: number;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onoptions: (anchor: HTMLElement) => void;
		onfinish: () => void;
	};

	let {
		cursor,
		meta,
		note,
		count,
		history,
		total,
		oncommit,
		ondraft,
		onrate,
		onoptions,
		onfinish
	}: Props = $props();

	// The tray is the rest timer's face on this screen — the global bar stands down here —
	// so the tick lives with it. 250ms: a 1s poll would hold a digit for up to two seconds.
	$effect(() => {
		if (!restTimer.running && !restTimer.undoing) {
			return;
		}

		restTimer.tick(Date.now());

		const id = setInterval(() => restTimer.tick(Date.now()), 250);

		return () => clearInterval(id);
	});

	// A backgrounded WebView throttles the interval, leaving `now` stale on the way back.
	function wake() {
		if (!document.hidden && (restTimer.running || restTimer.undoing)) {
			restTimer.tick(Date.now());
		}
	}

	// What lifting resumes on when the rest runs out, offered with the numbers the editor
	// would open on — the panel says where the session goes, not just how long it waits.
	const next = $derived.by(() => {
		if (cursor === null || meta === undefined) {
			return null;
		}

		const offer = prefillFor(cursor, history, meta);
		const place = cursor.workingIndex < 0 ? 'warmup' : `set ${cursor.workingIndex + 1}`;
		const numbers =
			offer.weight === null || offer.reps === null ? '' : ` · ${offer.weight} × ${offer.reps}`;

		return `${meta.name} — ${place}${numbers}`;
	});
</script>

<svelte:document onvisibilitychange={wake} />

<div class="shrink-0 overflow-hidden rounded-t-sheet border-t border-line bg-surface">
	{#if restTimer.running}
		<div role="timer" aria-label="Rest timer" class="relative">
			<div
				aria-hidden="true"
				class="absolute inset-y-0 left-0 bg-accent-soft
					motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
				style="width: {(restTimer.progress * 100).toFixed(1)}%"
			></div>

			<div class="relative mx-auto flex w-full max-w-xl flex-col gap-1.5 px-3 py-3">
				<div class="flex items-center gap-2">
					<span
						class={[
							'shrink-0 text-3xl font-extrabold tracking-numeral tabular-nums',
							restTimer.overtime ? 'text-accent-text' : 'text-ink'
						]}
					>
						{restTimer.label}
					</span>

					<span class="min-w-0 flex-1 truncate label-caps">
						{restTimer.exerciseName ?? 'Rest'}
					</span>

					{#snippet nudge(by: number, label: string)}
						<button
							type="button"
							aria-label={label}
							onclick={() => restTimer.nudge(by)}
							class="grid min-h-chip shrink-0 place-items-center rounded-lg bg-sunken px-2
								text-sm font-extrabold text-ink-muted tabular-nums focus-ring
								hover:bg-hover press:bg-surface-2 press:text-ink"
							{@attach press()}
						>
							{by < 0 ? '−' : '+'}{Math.abs(by)}
						</button>
					{/snippet}

					{@render nudge(-REST_NUDGE_SECONDS, `Cut ${REST_NUDGE_SECONDS} seconds`)}
					{@render nudge(REST_NUDGE_SECONDS, `Add ${REST_NUDGE_SECONDS} seconds`)}

					<button
						type="button"
						onclick={() => restTimer.skip()}
						class="grid min-h-chip shrink-0 place-items-center rounded-full border
							border-line px-3.5 text-sm font-extrabold tracking-wide text-accent-text focus-ring
							hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						SKIP
					</button>

					<button
						type="button"
						aria-label="No rest for the rest of this session"
						onclick={() => restTimer.mute()}
						class="grid min-h-chip w-9 shrink-0 place-items-center rounded-full
							text-ink-faint focus-ring hover:bg-hover press:bg-surface-2 press:text-ink"
						{@attach press()}
					>
						<BellSlash size={18} />
					</button>
				</div>

				{#if next !== null}
					<div class="flex items-baseline gap-1.5">
						<span class="shrink-0 label-caps">Next</span>
						<span class="min-w-0 truncate text-sm font-bold text-ink-muted">{next}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="mx-auto flex w-full max-w-xl flex-col px-3 py-3">
			{#if restTimer.undoing}
				<div
					role="status"
					class="-mt-0.5 mb-2 flex items-center gap-2 border-b border-line-soft pb-2"
				>
					<span class="min-w-0 flex-1 truncate label-caps">
						{restTimer.dismissedName ?? 'Rest'} — skipped
					</span>

					<button
						type="button"
						aria-label="Undo skipped rest"
						onclick={() => restTimer.undo()}
						class="grid min-h-chrome shrink-0 place-items-center rounded-full border border-line
							px-3 text-sm font-extrabold tracking-wide text-accent-text focus-ring
							hover:bg-hover press:bg-surface-2"
						{@attach press()}
					>
						UNDO
					</button>
				</div>
			{/if}

			{#if cursor !== null && meta !== undefined}
				<!-- Keyed so each set gets a fresh editor: what it captures on opening — the
				     recalled numbers, the previews — belongs to the set it opened on. -->
				{#key cursor.set.id}
					<ActiveSet
						{cursor}
						{history}
						{meta}
						{note}
						{count}
						step={(from, direction) => weightStep(meta.equipment, from, direction)}
						unit={loadUnitLabel(meta)}
						{oncommit}
						{ondraft}
						{onrate}
						{onoptions}
					/>
				{/key}
			{:else}
				<div class="flex items-center gap-3">
					<span
						class="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft
							text-accent-text"
					>
						<Check size={20} />
					</span>

					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-base font-extrabold tracking-tight text-ink">
							Every set logged
						</span>
						<span class="truncate text-sm font-bold text-ink-faint">
							{total} set{total === 1 ? '' : 's'}
						</span>
					</div>

					<Button variant="commit" compact caps onclick={onfinish}>FINISH</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
