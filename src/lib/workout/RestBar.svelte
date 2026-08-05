<script lang="ts">
	import { REST_NUDGE_SECONDS } from '$lib/domain/rest';
	import { press } from '$lib/ui/press';
	import BellSlash from '$lib/ui/icons/BellSlash.svelte';
	import { restTimer } from '$lib/workout/rest.svelte';

	/**
	 * The rest, running underneath.
	 *
	 * MARKET.md refuses the rest timer as a navigation destination, and this is
	 * the shape of that refusal: a strip docked at the foot of the app, never a
	 * screen, never a modal, never a thing to be dismissed before lifting again.
	 * It is rendered by the tab layout rather than by the workout page, so it
	 * survives the walk to Exercises mid-session — which is precisely when a
	 * countdown you cannot see is worthless.
	 *
	 * It is in flow at the bottom of the layout's column, so it never covers the
	 * last set of the session the way a fixed overlay would.
	 */

	/**
	 * The tick, and the only clock in the feature.
	 *
	 * Quarter-second, which is finer than the digits need and deliberately so:
	 * the label truncates, so polling on the second would show each number for
	 * anywhere between one and two seconds depending on when the rest started.
	 *
	 * It runs only while a rest is running and dies with the effect, so an idle
	 * app is not waking four times a second forever. Nothing is corrected on the
	 * way back from a suspended tab because nothing was counting: every reading
	 * is `endsAt` minus the clock, so a tick that never happened costs nothing.
	 */
	$effect(() => {
		if (!restTimer.running) {
			return;
		}

		restTimer.tick(Date.now());

		const id = setInterval(() => restTimer.tick(Date.now()), 250);

		return () => clearInterval(id);
	});

	function wake() {
		if (!document.hidden && restTimer.running) {
			restTimer.tick(Date.now());
		}
	}
</script>

<!-- The interval is throttled to a crawl in a backgrounded WebView, so the
     first frame back would otherwise be drawn against a stale `now`. One tick
     on the way in, before the browser paints. -->
<svelte:document onvisibilitychange={wake} />

{#if restTimer.running}
	<!-- `vt-tabbar` for the same reason the tab bar wears it: this sits inside
	     the box `(app)` slides between pages, and a name of its own lifts it out
	     of that snapshot so it stands still while the page under it travels. -->
	<div class="vt-tabbar shrink-0 lg:px-3 lg:pb-3">
		<div
			role="timer"
			aria-label="Rest timer"
			class="relative mx-auto flex items-center gap-2 overflow-hidden border-t border-line-soft
				bg-surface px-3 py-2 lg:max-w-md lg:rounded-full lg:border lg:px-2 lg:py-1.5"
		>
			<!-- The rest, drawn. It fills left to right and stays full through
			     overtime — `restProgress` clamps — so the track never contradicts the
			     digits beside it. `accent-soft` and not the accent itself: the lime
			     fill in this app means "this logs a set", and a bar that filled with
			     it would be promising a button. -->
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

			<!-- What the rest is for, and the first thing to go when the window is
			     narrow: the digits are the message and the name is the footnote.
			     The name alone, with no `Rest ·` in front of it — measured on a
			     420px phone, the prefix ate the exercise down to `BENCH PR…` to
			     restate what a counting clock above a tab bar already says. It
			     comes back only when there is no name to print. -->
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

			<!-- Not a `Button`: every variant that component offers is a commit, a
			     secondary or a piece of chrome sized for a header, and this is a
			     third thing — the loud control on a strip that has to stay under
			     56px so it does not eat the session above it. -->
			<button
				type="button"
				onclick={() => restTimer.clear()}
				class="relative grid min-h-chrome shrink-0 place-items-center rounded-full border
					border-line px-3 text-sm font-extrabold tracking-wide text-accent-text focus-ring
					hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				SKIP
			</button>

			<!-- Mute is the session's off switch, not the app's — PRODUCT.md wants
			     rest switchable off, and Settings holds the permanent answer. This is
			     the circuit day: gone at FINISH, editing nothing. -->
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
	</div>
{/if}
