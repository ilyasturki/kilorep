<script lang="ts">
	import type { Exercise } from '$lib/domain/exercise';
	import {
		canCommit,
		hintLabel,
		neverLogged,
		prefillFor,
		rampFor,
		rampLabel
	} from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ExertionPicker from '$lib/ui/ExertionPicker.svelte';
	import { tapCommit } from '$lib/ui/feedback';
	import StepperField, { INTEGER } from '$lib/ui/StepperField.svelte';
	import type { Step } from '$lib/ui/StepperField.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		cursor: SetCursor;
		history: History;
		meta: Exercise;
		note: string | null;
		/** Off where last time is beside the point — editing a record older than "last time". */
		hints?: boolean;
		step: Step;
		unit: string;
		oncommit: (weight: number, reps: number) => void;
		ondraft: (weight: number | null, reps: number | null) => void;
		onrate: (rpe: number | null) => void;
		onoptions: (anchor: HTMLElement) => void;
	};

	let {
		cursor,
		history,
		meta,
		note,
		hints = true,
		step,
		unit,
		oncommit,
		ondraft,
		onrate,
		onoptions
	}: Props = $props();

	const hint = $derived(hintLabel(history, cursor, meta, exertionScale.current));

	const warmup = $derived(cursor.workingIndex < 0);

	const recalls = $derived(hints && !warmup && (hint !== null || neverLogged(history, cursor)));

	const ramp = $derived(cursor.set.completed ? null : rampFor(cursor, history, meta));

	const rung = $derived(ramp === null ? null : rampLabel(ramp, meta));

	// The plan's own number, which the reps field cannot say for itself: what it holds is the
	// prefill, and from the second set on that is the weight and reps carried from the first.
	const planned = $derived(warmup ? null : cursor.set.plannedReps);

	// What the tray offers before a finger lands on it: the set's own numbers where it has any,
	// and where it has none the offer worked out afresh — the carry, the target, last time.
	// Nothing here is written back, so leaving the set is not the same as filling it in.
	const offer = $derived(prefillFor(cursor, history, meta));

	const weight = $derived(offer.weight);
	const reps = $derived(offer.reps);

	// svelte-ignore state_referenced_locally
	const opened = { weight: offer.weight, reps: offer.reps };

	let previewWeight = $state<number | null | undefined>();
	let previewReps = $state<number | null | undefined>();

	const liveWeight = $derived(previewWeight === undefined ? weight : previewWeight);
	const liveReps = $derived(previewReps === undefined ? reps : previewReps);

	const live = $derived(canCommit(liveWeight, liveReps));

	function settlePreviews() {
		previewWeight = undefined;
		previewReps = undefined;
	}

	const inertLabel = $derived(liveWeight === null ? 'Enter a weight to log' : 'Enter reps to log');

	const commitLabel = $derived(cursor.set.completed ? 'Update set' : 'Log set');

	let card = $state<HTMLElement | null>(null);

	function commit() {
		if (weight === null || reps === null) {
			return;
		}

		tapCommit();
		oncommit(weight, reps);
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

<div bind:this={card} onfocusout={settlePreviews} class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<!-- No name here. The list behind the tray says which exercise this is — the highlighted
		     row. What is left is what a lifter reads mid-set, each number under its own word, so
		     the target and last time stay apart at a glance instead of running into one line. -->
		<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-0.5">
			{#if planned !== null}
				<div class="flex items-baseline gap-1.5">
					<span class="label-caps">Target</span>
					<span class="text-base font-extrabold tracking-numeral text-ink">{planned} reps</span>
				</div>
			{/if}

			{#if warmup}
				<div class="flex min-w-0 items-baseline gap-1.5">
					<span class="label-caps">Warmup</span>
					{#if rung !== null}
						<span class="text-base font-extrabold tracking-numeral text-ink">{rung}</span>
					{/if}
				</div>
			{/if}

			{#if recalls}
				<div class="flex min-w-0 items-baseline gap-1.5">
					<span class="label-caps">Last</span>
					<span
						class={[
							'text-base font-extrabold tracking-numeral',
							hint === null ? 'text-ink-faint' : 'text-ink'
						]}
					>
						{hint ?? 'First time'}
					</span>
				</div>
			{/if}

			{#if note !== null}
				<span class="basis-full text-sm font-bold text-ink-faint">{note}</span>
			{/if}
		</div>

		<button
			type="button"
			aria-label="Set options"
			onclick={(e) => onoptions(e.currentTarget)}
			class="-my-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-lg
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
			ruler
			dense
			onchange={(v) => ondraft(v, reps)}
			onpreview={(v) => (previewWeight = v)}
		/>
		<StepperField
			label="reps"
			value={reps}
			recalled={opened.reps}
			step={1}
			entry={INTEGER}
			ruler
			dense
			onchange={(v) => ondraft(weight, v)}
			onpreview={(v) => (previewReps = v)}
		/>
	</div>

	<div class="flex flex-wrap items-stretch gap-2">
		<ExertionPicker value={cursor.set.rpe} scale={exertionScale.current} dense onchange={onrate} />

		<Button variant="commit" disabled={!live} class="flex-1" onclick={commit}>
			{#if live}
				<Check size={24} />
				{commitLabel}
			{:else}
				{inertLabel}
			{/if}
		</Button>
	</div>
</div>
