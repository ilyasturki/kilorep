<script lang="ts">
	import { press } from '$lib/ui/press';
	import { restTimer } from '$lib/workout/rest.svelte';

	// The pill is the rest timer's only face on the desktop screen — the tray that owns the
	// tick on a phone is not mounted there — so the clock lives here too. Same cadence as the
	// tray: 250ms, because a 1s poll would hold a digit for up to two seconds.
	$effect(() => {
		if (!restTimer.running && !restTimer.undoing) {
			return;
		}

		restTimer.tick(Date.now());

		const id = setInterval(() => restTimer.tick(Date.now()), 250);

		return () => clearInterval(id);
	});

	// A backgrounded tab throttles the interval, leaving `now` stale on the way back.
	function wake() {
		if (!document.hidden && (restTimer.running || restTimer.undoing)) {
			restTimer.tick(Date.now());
		}
	}
</script>

<svelte:document onvisibilitychange={wake} />

{#if restTimer.running}
	<div
		role="timer"
		aria-label="Rest timer"
		class="flex min-h-chrome items-center gap-2 rounded-full bg-accent-soft py-0.5 pr-1 pl-3.5"
	>
		<span
			class={[
				'text-base font-extrabold tracking-numeral tabular-nums',
				restTimer.overtime ? 'text-accent-text' : 'text-ink'
			]}
		>
			{restTimer.label}
		</span>

		<span class="max-w-32 truncate label-caps">{restTimer.exerciseName ?? 'Rest'}</span>

		<button
			type="button"
			onclick={() => restTimer.skip()}
			class="grid min-h-7 shrink-0 place-items-center rounded-full bg-surface px-2.5 text-xs
				font-extrabold tracking-wide text-accent-text focus-ring hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			SKIP
		</button>
	</div>
{:else if restTimer.undoing}
	<div
		role="status"
		class="flex min-h-chrome items-center gap-2 rounded-full bg-sunken py-0.5 pr-1 pl-3.5"
	>
		<span class="max-w-44 truncate label-caps">
			{restTimer.dismissedName ?? 'Rest'} — skipped
		</span>

		<button
			type="button"
			aria-label="Undo skipped rest"
			onclick={() => restTimer.undo()}
			class="grid min-h-7 shrink-0 place-items-center rounded-full bg-surface px-2.5 text-xs
				font-extrabold tracking-wide text-accent-text focus-ring hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			UNDO
		</button>
	</div>
{/if}
