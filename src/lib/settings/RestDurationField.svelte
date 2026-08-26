<script lang="ts" module>
	import {
		MAX_REST_SECONDS,
		MIN_REST_SECONDS,
		REST_STEP_SECONDS,
		parseRestDraft,
		restDraft,
		restLabel,
		snapRestSeconds
	} from '$lib/domain/rest';
	import type { Entry } from '$lib/ui/StepperField.svelte';

	// A duration counts in a clock's units, not a number line's: it reads `2:30`, it is typed
	// `2 3 0` on a pad that has no colon to offer, and wherever it lands it joins the same
	// fifteens the arms and the ruler step through.
	const CLOCK: Entry = {
		draft: restDraft,
		parse: parseRestDraft,
		format: (seconds) => restLabel(seconds * 1000),
		snap: snapRestSeconds,
		inputmode: 'numeric'
	};
</script>

<script lang="ts">
	import StepperField from '$lib/ui/StepperField.svelte';

	type Props = {
		label: string;
		description?: string;
		seconds: number;
		disabled?: boolean;
		// Whether a tap on the number brings the ladder up. On by default, because that is what
		// every other number in the app does; a caller that stands somewhere the pane cannot
		// reach over says so here, and keeps the arms and the keyboard.
		ruler?: boolean;
		onchange: (seconds: number) => void;
	};

	let { label, description, seconds, disabled = false, ruler = true, onchange }: Props = $props();
</script>

<div class={['flex items-center justify-between gap-4', disabled && 'opacity-50']}>
	<span class="min-w-0">
		<span class="block text-base font-bold text-ink">{label}</span>
		{#if description}
			<span class="block text-sm font-bold text-ink-faint">{description}</span>
		{/if}
	</span>

	<StepperField
		compact
		{ruler}
		{label}
		{disabled}
		value={seconds}
		entry={CLOCK}
		step={REST_STEP_SECONDS}
		min={MIN_REST_SECONDS}
		max={MAX_REST_SECONDS}
		nullable={false}
		onchange={(next) => {
			if (next !== null) {
				onchange(next);
			}
		}}
		class="min-h-chip w-40 shrink-0"
	/>
</div>
