<script lang="ts">
	type Props = {
		points: { x: number; y: number }[];
		width?: number;
		height?: number;
	};

	let { points, width = 96, height = 28 }: Props = $props();

	const PAD = 3;

	const sx = $derived.by(() => {
		const xs = points.map((point) => point.x);
		const lo = Math.min(...xs);
		const hi = Math.max(...xs);

		return (x: number) =>
			hi === lo ? width / 2 : PAD + ((x - lo) / (hi - lo)) * (width - 2 * PAD);
	});

	const sy = $derived.by(() => {
		const ys = points.map((point) => point.y);
		const lo = Math.min(...ys);
		const hi = Math.max(...ys);

		return (y: number) =>
			hi === lo ? height / 2 : PAD + ((hi - y) / (hi - lo)) * (height - 2 * PAD);
	});

	const path = $derived(
		points
			.map(
				(point, i) => `${i === 0 ? 'M' : 'L'}${sx(point.x).toFixed(1)},${sy(point.y).toFixed(1)}`
			)
			.join('')
	);
</script>

{#if points.length > 0}
	<svg {width} {height} aria-hidden="true" focusable="false" class="block shrink-0">
		{#if points.length === 1}
			<circle cx={width / 2} cy={height / 2} r="3" class="fill-ink" />
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
	</svg>
{/if}
