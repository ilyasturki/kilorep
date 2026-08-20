<script lang="ts">
	import {
		MAX_REST_SECONDS,
		MIN_REST_SECONDS,
		REST_STEP_SECONDS,
		restLabel,
		settleRestSeconds
	} from '$lib/domain/rest';
	import { tapTick } from '$lib/ui/feedback';
	import MiniStepper from '$lib/ui/MiniStepper.svelte';

	type Props = {
		label: string;
		description?: string;
		seconds: number;
		disabled?: boolean;
		onchange: (seconds: number) => void;
	};

	let { label, description, seconds, disabled = false, onchange }: Props = $props();

	const shown = $derived(restLabel(seconds * 1000));

	const atFloor = $derived(seconds <= MIN_REST_SECONDS);
	const atCeiling = $derived(seconds >= MAX_REST_SECONDS);

	function step(direction: number) {
		const next = settleRestSeconds(seconds + direction * REST_STEP_SECONDS);

		if (next === seconds) {
			return;
		}

		tapTick();
		onchange(next);
	}
</script>

<div class={['flex items-center justify-between gap-4', disabled && 'opacity-50']}>
	<span class="min-w-0">
		<span class="block text-base font-bold text-ink">{label}</span>
		{#if description}
			<span class="block text-sm font-bold text-ink-faint">{description}</span>
		{/if}
	</span>

	<MiniStepper
		{label}
		value={shown}
		ondec={disabled || atFloor ? null : () => step(-1)}
		oninc={disabled || atCeiling ? null : () => step(1)}
		class="min-h-chip w-40 shrink-0 border border-line"
	/>
</div>
