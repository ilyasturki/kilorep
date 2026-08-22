<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ExertionPicker from '$lib/ui/ExertionPicker.svelte';
	import { revealEnd } from '$lib/ui/scroll';
	import SetMark from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import type { Step } from '$lib/ui/StepperField.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		cursor: SetCursor;
		step: Step;
		unit: string;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		ondone: () => void;
		onoptions: (anchor: HTMLElement) => void;
	};

	let { cursor, step, unit, ondraft, onrate, ondone, onoptions }: Props = $props();

	const weight = $derived(cursor.set.weight);
	const reps = $derived(cursor.set.reps);

	// svelte-ignore state_referenced_locally
	const opened = { weight: cursor.set.weight, reps: cursor.set.reps };

	let card = $state<HTMLElement | null>(null);

	function reveal(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement) || card === null) {
			return;
		}

		revealEnd(card);
	}

	function onkeydown(event: KeyboardEvent) {
		const target = event.target;

		if (event.key !== 'Enter' || !(target instanceof HTMLInputElement)) {
			return;
		}

		if (card !== null && card.contains(target)) {
			ondone();
		}
	}
</script>

<svelte:window {onkeydown} />

<div
	bind:this={card}
	onfocusin={reveal}
	class="relative scroll-mb-3 overflow-hidden rounded-2xl bg-surface"
>
	<div class="flex flex-col gap-3 py-3 pr-3 pl-4">
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-3">
				<SetMark status="active" index={cursor.workingIndex + 1} />
				<span class="label-caps">
					{cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`}
				</span>
			</div>

			<button
				type="button"
				aria-label="Set options"
				onclick={(e) => onoptions(e.currentTarget)}
				class="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-lg
					text-ink-faint focus-ring hover:bg-hover press:bg-surface-2"
				{@attach press()}
			>
				<More size={20} />
			</button>
		</div>

		<div class="stepper-pair">
			<StepperField
				label={unit}
				value={weight}
				recalled={opened.weight}
				{step}
				onchange={(v) => ondraft(v, reps)}
			/>
			<StepperField
				label="reps"
				value={reps}
				recalled={opened.reps}
				step={1}
				onchange={(v) => ondraft(weight, v)}
			/>
		</div>

		<div class="flex flex-wrap items-stretch gap-2">
			<ExertionPicker value={cursor.set.rpe} scale={exertionScale.current} onchange={onrate} />

			<Button variant="secondary" class="flex-1" onclick={ondone}>Done</Button>
		</div>
	</div>
</div>
