<script lang="ts">
	import type { BodyweightEntry } from '$lib/domain/bodyweight';
	import { addDays } from '$lib/domain/bodyweight';

	type Props = {
		dots: BodyweightEntry[];
		line: BodyweightEntry[];
		today: string;
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

			{#each dots as dot (dot.date)}
				<circle
					cx={x(dot.date)}
					cy={y(dot.kg)}
					r="3"
					class="fill-ink-faint stroke-surface"
					stroke-width="2"
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
