<script lang="ts">
	import type { BodyweightEntry } from '$lib/domain/bodyweight';
	import { addDays } from '$lib/domain/bodyweight';

	/**
	 * The trend: raw weigh-ins as faint dots, the 7-day rolling average as the
	 * line. Both layers on purpose — daily weight swings on water and meal
	 * timing by more than a real week's change, so the average is the signal,
	 * and the dots keep it honest about being derived.
	 *
	 * The app's first chart, and deliberately monochrome: the line wears ink,
	 * the dots wear the faint step, and the accent stays out of it — the accent
	 * means "this logs a set", and a reading is not that. One series, so no
	 * legend: the section heading already names what is plotted.
	 *
	 * The x-domain is the fixed window, not the data: a fortnight of entries
	 * sits in its own corner of the twelve weeks rather than stretching to fill
	 * them, because "how long have I been tracking" is part of what the chart
	 * answers.
	 *
	 * Geometry in device pixels via `bind:clientWidth` rather than a scaled
	 * viewBox, so hairlines stay hairlines and text stays text-sized.
	 */
	type Props = {
		/** Raw entries inside the window, oldest first. */
		dots: BodyweightEntry[];
		/** The rolling average inside the window, oldest first. */
		line: BodyweightEntry[];
		/** The window's last day, inclusive — the right edge. */
		today: string;
		/** Window length in calendar days. */
		days?: number;
	};

	let { dots, line, today, days = 84 }: Props = $props();

	let width = $state(0);

	const HEIGHT = 200;
	const TOP = 12;
	const BOTTOM = 24;
	const LEFT = 40;
	const RIGHT = 12;

	const innerWidth = $derived(Math.max(0, width - LEFT - RIGHT));
	const innerHeight = HEIGHT - TOP - BOTTOM;

	// ISO date-only strings parse as UTC midnight — a fixed ruler, immune to
	// the DST steps a local-time parse would fold into the spacing.
	const at = (date: string): number => Date.parse(date);

	const from = $derived(addDays(today, -(days - 1)));
	const t0 = $derived(at(from));
	const t1 = $derived(at(today));

	const x = $derived((date: string) => LEFT + ((at(date) - t0) / (t1 - t0)) * innerWidth);

	/**
	 * The y-domain hugs the data, padded so the extremes never sit on the
	 * frame; zero would be absurd here — nobody weighs nothing, and a weight
	 * axis from zero flattens a real cut into a flat line.
	 */
	const domain = $derived.by(() => {
		const values = [...dots, ...line].map((entry) => entry.kg);
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const pad = Math.max(0.4, (hi - lo) * 0.15);

		return { lo: lo - pad, hi: hi + pad };
	});

	const y = $derived(
		(kg: number) => TOP + ((domain.hi - kg) / (domain.hi - domain.lo)) * innerHeight
	);

	/** Clean-numbered y ticks: the coarsest step that still yields two or more. */
	const ticks = $derived.by(() => {
		const span = domain.hi - domain.lo;
		const step = [10, 5, 2, 1, 0.5].find((s) => span / s >= 2) ?? 0.5;

		const out: number[] = [];

		for (let v = Math.ceil(domain.lo / step) * step; v <= domain.hi; v += step) {
			out.push(Math.round(v * 10) / 10);
		}

		return out;
	});

	/** First-of-month marks inside the window — the only x labels 12 weeks need. */
	const months = $derived.by(() => {
		const out: string[] = [];
		const start = new Date(t0);

		let year = start.getUTCFullYear();
		let month = start.getUTCMonth() + 1;

		for (;;) {
			if (month > 12) {
				month = 1;
				year += 1;
			}

			const date = `${year}-${String(month).padStart(2, '0')}-01`;

			if (date > today) {
				return out;
			}

			if (date >= from) {
				out.push(date);
			}

			month += 1;
		}
	});

	const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
	const dayLabel = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});

	const path = $derived(
		line
			.map(
				(entry, i) => `${i === 0 ? 'M' : 'L'}${x(entry.date).toFixed(1)},${y(entry.kg).toFixed(1)}`
			)
			.join('')
	);

	/**
	 * The hover layer: nearest weigh-in to the pointer, crosshair on its day,
	 * the numbers in a fixed readout above the plot — a floating tooltip on a
	 * phone hides under the finger that asked for it.
	 */
	let hovered = $state<number | null>(null);

	function locate(event: PointerEvent & { currentTarget: SVGSVGElement }) {
		if (dots.length === 0) {
			return;
		}

		const px = event.clientX - event.currentTarget.getBoundingClientRect().left;

		let best = 0;

		for (let i = 1; i < dots.length; i++) {
			if (Math.abs(x(dots[i].date) - px) < Math.abs(x(dots[best].date) - px)) {
				best = i;
			}
		}

		hovered = best;
	}

	const readout = $derived.by(() => {
		if (hovered === null) {
			return null;
		}

		const dot = dots[hovered];
		const averaged = line.find((entry) => entry.date === dot.date);

		return {
			dot,
			label: `${dayLabel.format(at(dot.date))} · ${dot.kg} kg`,
			average: averaged === undefined ? null : `7d ${Math.round(averaged.kg * 10) / 10}`
		};
	});
</script>

<div class="relative" bind:clientWidth={width}>
	{#if readout !== null}
		<p
			class="pointer-events-none absolute top-0 right-3 rounded-lg bg-surface-2 px-2 py-0.5
				text-sm font-bold text-ink tabular-nums"
		>
			{readout.label}
			{#if readout.average !== null}
				<span class="text-ink-faint">· {readout.average}</span>
			{/if}
		</p>
	{/if}

	{#if width > 0}
		<svg
			{width}
			height={HEIGHT}
			role="img"
			aria-label="Body weight, last 12 weeks: raw entries and 7-day average"
			class="block touch-pan-y select-none"
			onpointermove={locate}
			onpointerdown={locate}
			onpointerleave={() => (hovered = null)}
		>
			<!-- Recessive furniture first: hairline gridlines, solid, one step off
			     the surface, with the tick values in muted text tokens. -->
			{#each ticks as tick (tick)}
				<line
					x1={LEFT}
					x2={width - RIGHT}
					y1={y(tick)}
					y2={y(tick)}
					class="stroke-line-soft"
					stroke-width="1"
				/>
				<text
					x={LEFT - 8}
					y={y(tick) + 3.5}
					text-anchor="end"
					class="fill-ink-faint text-xs font-bold tabular-nums"
				>
					{tick}
				</text>
			{/each}

			{#each months as month (month)}
				<text
					x={x(month)}
					y={HEIGHT - 8}
					text-anchor="middle"
					class="fill-ink-faint text-xs font-bold"
				>
					{monthLabel.format(at(month))}
				</text>
			{/each}

			{#if readout !== null}
				<line
					x1={x(readout.dot.date)}
					x2={x(readout.dot.date)}
					y1={TOP}
					y2={TOP + innerHeight}
					class="stroke-line"
					stroke-width="1"
				/>
			{/if}

			<!-- The raw layer: faint dots, each ringed in the surface colour so a
			     dot crossing the line stays a dot. -->
			{#each dots as dot (dot.date)}
				<circle
					cx={x(dot.date)}
					cy={y(dot.kg)}
					r="3"
					class="fill-ink-faint stroke-surface"
					stroke-width="2"
				/>
			{/each}

			<!-- The signal: the 7-day average, 2px, round-capped ink. -->
			{#if line.length === 1}
				<circle cx={x(line[0].date)} cy={y(line[0].kg)} r="4" class="fill-ink" />
			{:else}
				<path
					d={path}
					fill="none"
					class="stroke-ink"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}

			{#if readout !== null}
				<circle
					cx={x(readout.dot.date)}
					cy={y(readout.dot.kg)}
					r="4.5"
					class="fill-ink stroke-surface"
					stroke-width="2"
				/>
			{/if}
		</svg>
	{/if}
</div>
