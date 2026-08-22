<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import type { CarriedOn } from '$lib/domain/load';
	import { estTrend, WEEK } from '$lib/domain/progress';
	import type { PastSession } from '$lib/domain/stats';
	import { bestEstimate } from '$lib/domain/stats';
	import { loadLabel } from '$lib/exercises/label';
	import LoadCalculator from '$lib/exercises/LoadCalculator.svelte';
	import Sparkline from '$lib/progress/Sparkline.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		exercise: Exercise;
		/** One grip's whole history, oldest first — the same list the best and the rows read. */
		past: PastSession[];
		carried: CarriedOn;
		now: number;
	};

	let { exercise, past, carried, now }: Props = $props();

	/** The same twelve weeks Progress draws, so a lift read on both screens says one thing. */
	const WINDOW_WEEKS = 12;

	const since = $derived(now - WINDOW_WEEKS * WEEK);

	/**
	 * The last session's best set, and what it estimates.
	 *
	 * The latest rather than the best ever, and not from the window either: this number is where
	 * the lifter stands now, which is the only footing the load under it can be worked out from
	 * — a best set from a spring the lifter was eight kilos heavier estimates a bar they cannot
	 * hold today. A lift left alone since then still states it, because the strength did not
	 * leave with the sessions, and drawing nothing would say it had.
	 */
	const latest = $derived(past.at(-1) ?? null);

	const current = $derived(latest === null ? null : bestEstimate([latest], carried));

	const window = $derived(estTrend(past, since, carried));

	const points = $derived(window.map((point) => ({ x: point.date, y: point.est })));

	const first = $derived(window.at(0));
	const last = $derived(window.at(-1));

	const delta = $derived(
		first === undefined || last === undefined || window.length < 2 ? null : last.est - first.est
	);

	function deltaLabel(kg: number): string {
		const rung = Math.round(kg * 2) / 2;

		if (rung > 0) {
			return `+${rung}`;
		}

		return rung < 0 ? `−${Math.abs(rung)}` : 'level';
	}

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	let open = $state(false);
	const panelId = $props.id();

	const today = $derived(carried(now));
</script>

{#if current !== null && current.est > 0}
	<section class="flex flex-col gap-2">
		<h2 class="px-3">
			<Tooltip
				text="Epley, from the best set of each session. A direction to read, never the best you
					have lifted."
			>
				<span class="label-caps">Estimated 1RM</span>
			</Tooltip>
		</h2>

		<div class="list-group">
			<div class="flex items-center gap-3 px-3 py-2.5">
				<!-- The same size and weight the best above it is set in, deliberately: an estimate
				     drawn larger than the thing actually lifted is the screen naming the wrong one
				     as the headline. -->
				<span class="text-md font-extrabold tracking-numeral text-ink tabular-nums">
					{loadLabel(Math.round(current.est * 2) / 2)}<span class="text-sm font-bold text-ink-faint"
						>&nbsp;kg</span
					>
				</span>

				{#if points.length > 1}
					<Sparkline {points} />

					<span class="ml-auto flex flex-col items-end">
						<span class="text-md font-extrabold tracking-numeral text-ink-faint tabular-nums">
							{delta === null ? '' : deltaLabel(delta)}
						</span>
						<span class="text-sm font-bold text-ink-faint">{WINDOW_WEEKS} weeks</span>
					</span>
				{:else}
					<!-- One session inside the window, or none: a line through a single point is a
					     claim about a direction nothing measured. The date says where it came from. -->
					<span class="ml-auto text-sm font-bold text-ink-faint">
						{day.format(current.date)}
					</span>
				{/if}
			</div>

			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onclick={() => (open = !open)}
				class="flex min-h-chrome w-full items-center gap-2 px-3 text-md font-bold
					text-ink-muted focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<CaretDown size={16} class={open ? 'rotate-180' : '-rotate-90'} />
				Work out a load
			</button>

			{#if open}
				<!-- Keyed on the set it opens from: the fields are the lifter's once touched and must
				     not be rewritten under them, but a grip chip switched with the panel open is a
				     different lift entirely, and holding the rope's numbers over the bar's is the
				     calculator answering a question nobody asked it. -->
				<div id={panelId}>
					{#key current.set}
						<LoadCalculator {exercise} carried={today} seed={current.set} />
					{/key}
				</div>
			{/if}
		</div>
	</section>
{/if}
