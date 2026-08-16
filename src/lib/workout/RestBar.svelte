<script lang="ts">
	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import { press } from '$lib/ui/press';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';
	import { restTimer } from '$lib/workout/rest.svelte';

	// 250ms: the label truncates, so a 1s poll would hold a digit for up to two seconds.
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
</script>

<svelte:document onvisibilitychange={wake} />

{#if restTimer.running || restTimer.undoing}
	<div class="vt-tabbar shrink-0 lg:px-3 lg:pb-3">
		{#if !restTimer.running}
			<div
				role="status"
				class="mx-auto flex items-center gap-2 border-t border-line-soft bg-surface px-3 py-2
					lg:max-w-md lg:rounded-full lg:border lg:px-2 lg:py-1.5"
			>
				<span class="min-w-0 flex-1 truncate label-caps">
					{restTimer.dismissedName ?? 'Rest'}
				</span>

				<button
					type="button"
					aria-label="Undo skipped rest"
					onclick={() => restTimer.undo()}
					class="grid min-h-chrome shrink-0 place-items-center rounded-full border border-line px-3
						text-sm font-extrabold tracking-wide text-accent-text focus-ring hover:bg-hover
						press:bg-surface-2"
					{@attach press()}
				>
					UNDO
				</button>
			</div>
		{:else}
			<div
				role="timer"
				aria-label="Rest timer"
				class="relative mx-auto flex items-center gap-2 overflow-hidden border-t border-line-soft
					bg-surface px-3 py-2 lg:max-w-md lg:rounded-full lg:border lg:px-2 lg:py-1.5"
			>
				<div
					aria-hidden="true"
					class="absolute inset-y-0 left-0 bg-accent-soft
						motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
					style="width: {(restTimer.progress * 100).toFixed(1)}%"
				></div>

				<span
					class={[
						'relative shrink-0 text-2xl font-extrabold tracking-tight tabular-nums',
						restTimer.overtime ? 'text-accent-text' : 'text-ink'
					]}
				>
					{restTimer.label}
				</span>

				<span class="relative min-w-0 flex-1 truncate label-caps">
					{restTimer.exerciseName ?? 'Rest'}
				</span>

				{#snippet nudge(by: number, label: string)}
					<button
						type="button"
						aria-label={label}
						onclick={() => restTimer.nudge(by)}
						class="relative grid min-h-chrome shrink-0 place-items-center rounded-lg bg-sunken px-2
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
					class="relative grid min-h-chrome shrink-0 place-items-center rounded-full border
						border-line px-3 text-sm font-extrabold tracking-wide text-accent-text focus-ring
						hover:bg-hover press:bg-surface-2"
					{@attach press()}
				>
					SKIP
				</button>

				<button
					type="button"
					aria-label="No rest for the rest of this session"
					onclick={() => restTimer.mute()}
					class="relative grid min-h-chrome w-9 shrink-0 place-items-center rounded-full
						text-ink-faint focus-ring hover:bg-hover press:bg-surface-2 press:text-ink"
					{@attach press()}
				>
					<BellSlash size={18} />
				</button>
			</div>
		{/if}
	</div>
{/if}
