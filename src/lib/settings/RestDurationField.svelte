<script lang="ts">
	import {
		MAX_REST_SECONDS,
		MIN_REST_SECONDS,
		REST_STEP_SECONDS,
		restLabel,
		settleRestSeconds
	} from '$lib/domain/rest';
	import { tapLift } from '$lib/ui/haptics';
	import MiniStepper from '$lib/ui/MiniStepper.svelte';

	type Props = {
		label: string;
		description?: string;
		seconds: number;
		disabled?: boolean;
		onchange: (seconds: number) => void;
	};

	let { label, description, seconds, disabled = false, onchange }: Props = $props();

	/**
	 * Not `StepperField`. That component belongs to the logging loop — it carries
	 * a recalled value, a preview channel and a typable input, all of which exist
	 * because a weight is a number the user has an opinion about mid-set. A rest
	 * is `2:00`, and typing `120` into a box labelled seconds is a translation
	 * step nobody should be asked to perform.
	 *
	 * Fifteen-second steps: the difference between 2:00 and 2:15 is real and the
	 * difference between 2:00 and 2:01 is not, and the coarser step is what keeps
	 * a change of mind to two taps rather than eight.
	 */

	const shown = $derived(restLabel(seconds * 1000));

	const atFloor = $derived(seconds <= MIN_REST_SECONDS);
	const atCeiling = $derived(seconds >= MAX_REST_SECONDS);

	function step(direction: number) {
		const next = settleRestSeconds(seconds + direction * REST_STEP_SECONDS);

		if (next === seconds) {
			return;
		}

		tapLift();
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
