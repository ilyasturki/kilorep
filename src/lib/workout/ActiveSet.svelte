<script lang="ts">
	import { canCommit, hintLabel } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ExertionPicker from '$lib/ui/ExertionPicker.svelte';
	import { tapCommit } from '$lib/ui/haptics';
	import { revealEnd } from '$lib/ui/scroll';
	import SetMark from '$lib/ui/SetMark.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';

	type Props = {
		cursor: SetCursor;
		history: History;
		step: number;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onoptions: (anchor: HTMLElement) => void;
	};

	let { cursor, history, step, oncommit, ondraft, onrate, onoptions }: Props = $props();

	const hint = $derived(hintLabel(history, cursor, exertionScale.current));

	const weight = $derived(cursor.set.weight);
	const reps = $derived(cursor.set.reps);

	// svelte-ignore state_referenced_locally
	const opened = { weight: cursor.set.weight, reps: cursor.set.reps };

	let previewWeight = $state<number | null | undefined>();
	let previewReps = $state<number | null | undefined>();

	const liveWeight = $derived(previewWeight === undefined ? weight : previewWeight);
	const liveReps = $derived.by(() => {
		if (previewReps === undefined) {
			return reps;
		}

		return previewReps === null ? null : Math.round(previewReps);
	});

	const live = $derived(canCommit(liveWeight, liveReps));

	function settlePreviews() {
		previewWeight = undefined;
		previewReps = undefined;
	}

	const inertLabel = $derived(liveWeight === null ? 'Enter a weight to log' : 'Enter reps to log');

	const status = $derived.by<SetStatus>(() => {
		if (cursor.set.type === 'warmup') {
			return 'warmup';
		}

		return cursor.set.completed ? 'done' : 'active';
	});

	const commitLabel = $derived(cursor.set.completed ? 'Update set' : 'Log set');

	let card = $state<HTMLElement | null>(null);

	function commit() {
		if (weight === null || reps === null) {
			return;
		}

		tapCommit();
		oncommit(weight, reps);
	}

	function reveal(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement) || card === null) {
			return;
		}

		revealEnd(card);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || !live) {
			return;
		}

		const target = event.target;
		const typing = target instanceof HTMLInputElement && card !== null && card.contains(target);

		if (target !== document.body && !typing) {
			return;
		}

		commit();
	}
</script>

<svelte:window {onkeydown} />

<div
	bind:this={card}
	onfocusin={reveal}
	onfocusout={settlePreviews}
	class="relative scroll-mb-3 overflow-hidden card-active"
>
	<div class="absolute inset-y-0 left-0 w-1.5 bg-accent-text" aria-hidden="true"></div>

	<div class="flex flex-col gap-3 py-3 pr-3 pl-4">
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-3">
				<SetMark {status} index={cursor.workingIndex + 1} />
				<span class="label-caps">
					{cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`}
				</span>
			</div>

			<div class="flex shrink-0 items-center gap-1">
				<span class="text-sm font-bold text-ink-faint">
					{hint === null ? 'First time' : `Last ${hint}`}
				</span>

				<button
					type="button"
					aria-label="Set options"
					onclick={(e) => onoptions(e.currentTarget)}
					class="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-lg
						text-ink-faint focus-ring hover:bg-hover active:bg-surface-2"
				>
					<More size={20} />
				</button>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<StepperField
				label="kg"
				value={weight}
				recalled={opened.weight}
				{step}
				onchange={(v) => ondraft(v, reps)}
				onpreview={(v) => (previewWeight = v)}
			/>
			<StepperField
				label="reps"
				value={reps}
				recalled={opened.reps}
				step={1}
				onchange={(v) => ondraft(weight, v === null ? null : Math.round(v))}
				onpreview={(v) => (previewReps = v)}
			/>
		</div>

		<div class="flex flex-wrap items-stretch gap-2">
			<ExertionPicker value={cursor.set.rpe} scale={exertionScale.current} onchange={onrate} />

			<Button variant="commit" disabled={!live} class="flex-1" onclick={commit}>
				{#if live}
					<Check size={30} />
					{commitLabel}
				{:else}
					{inertLabel}
				{/if}
			</Button>
		</div>
	</div>
</div>
