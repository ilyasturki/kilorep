<script lang="ts">
	import type { BodyweightEntry } from '$lib/domain/bodyweight';

	type Props = {
		dots: BodyweightEntry[];
		line: BodyweightEntry[];
		today: string;
		/** The window's left edge, inclusive. The caller owns it because the
		 *  range control does, and `all` has no day count to derive it from. */
		from: string;
		/** Spoken to a screen reader, which cannot see the range control. */
		range: string;
	};

	let { dots, line, today, from, range }: Props = $props();

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

	const t0 = $derived(at(from));
	const t1 = $derived(at(today));

	// A window one day wide would divide by zero and put every dot at `NaN`.
	// `all` on a log with one entry is exactly that, and it is the first thing
	// anybody sees after their first weigh-in.
	const axisSpan = $derived(Math.max(1, t1 - t0));

	const x = $derived((date: string) => LEFT + ((at(date) - t0) / axisSpan) * innerWidth);

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

	const ticks = $derived.by(() => {
		const span = domain.hi - domain.lo;
		const step = [10, 5, 2, 1, 0.5].find((s) => span / s >= 2) ?? 0.5;

		const out: number[] = [];

		for (let v = Math.ceil(domain.lo / step) * step; v <= domain.hi; v += step) {
			out.push(Math.round(v * 10) / 10);
		}

		return out;
	});

	/**
	 * Every month boundary inside the window, then thinned until at most seven
	 * survive. Twelve `Jan Feb Mar…` under a year of data is a grey smear rather
	 * than a scale, and the thinning steps through 1 · 2 · 3 · 6 · 12 months
	 * because those are the divisions of a year a reader already holds — a step
	 * of five would put labels on May and October and mean nothing.
	 *
	 * Anchored to the last boundary rather than the first, so the label nearest
	 * today always survives: that is the end of the axis the eye starts from.
	 */
	const months = $derived.by(() => {
		const all: string[] = [];
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
				break;
			}

			if (date >= from) {
				all.push(date);
			}

			month += 1;
		}

		const step = [1, 2, 3, 6, 12].find((candidate) => all.length / candidate <= 7) ?? 12;

		return all.filter((_, index) => (all.length - 1 - index) % step === 0);
	});

	/**
	 * The year rides along the moment the window crosses one, because `Feb`
	 * drawn twice on a two-year axis names two different Februaries and the
	 * reader has no way to tell which is which. Two digits, not four: `Feb 25`
	 * is unambiguous at 11px and `February 2025` is a paragraph on a tick.
	 *
	 * Below that it stays off. On the default twelve weeks the year is the same
	 * one every label already implies, and printing it is noise on the axis a
	 * reader looks at most.
	 */
	const yearly = $derived(from.slice(0, 4) !== today.slice(0, 4));

	// Dense windows draw a hairline dot with no halo: at a year the raw entries
	// outnumber the pixels between them, and a 3px circle ringed in `surface`
	// merges into a band that hides the average line it is supposed to sit under.
	const dotSize = $derived.by(() => {
		if (dots.length > 160) {
			return 1.4;
		}

		return dots.length > 90 ? 2 : 3;
	});

	/**
	 * Which end of the label sits on its tick. Centred everywhere in the middle
	 * of the axis, and turned inward at the two edges — the newest boundary can
	 * land within a few days of `today`, which puts a centred `Aug 26` half
	 * outside the SVG and clipped. Re-anchoring keeps the label attached to the
	 * tick it names, where nudging its `x` would quietly move it to a date it
	 * does not mean.
	 */
	function anchorAt(px: number): 'start' | 'middle' | 'end' {
		if (px > width - RIGHT - 22) {
			return 'end';
		}

		return px < LEFT + 22 ? 'start' : 'middle';
	}

	const enGB = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
		new Intl.DateTimeFormat('en-GB', options);

	const monthLabel = enGB({ month: 'short', timeZone: 'UTC' });
	const monthYearLabel = enGB({ month: 'short', year: '2-digit', timeZone: 'UTC' });
	const dayLabel = enGB({ day: 'numeric', month: 'short', timeZone: 'UTC' });
	// The readout carries the year exactly when the axis has stopped naming
	// months: `3 Aug` on a five-year chart names five different days.
	const dayYearLabel = enGB({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

	const path = $derived(
		line
			.map(
				(entry, i) => `${i === 0 ? 'M' : 'L'}${x(entry.date).toFixed(1)},${y(entry.kg).toFixed(1)}`
			)
			.join('')
	);

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
			label: `${(yearly ? dayYearLabel : dayLabel).format(at(dot.date))} · ${dot.kg} kg`,
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
			aria-label="Body weight, {range}: raw entries and 7-day average"
			class="block touch-pan-y select-none"
			onpointermove={locate}
			onpointerdown={locate}
			onpointerleave={() => (hovered = null)}
		>
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
					text-anchor={anchorAt(x(month))}
					class="fill-ink-faint text-xs font-bold"
				>
					{(yearly ? monthYearLabel : monthLabel).format(at(month))}
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

			{#each dots as dot (dot.date)}
				<circle
					cx={x(dot.date)}
					cy={y(dot.kg)}
					r={dotSize}
					class="fill-ink-faint stroke-surface"
					stroke-width={dotSize < 2.5 ? 0 : 2}
				/>
			{/each}

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
