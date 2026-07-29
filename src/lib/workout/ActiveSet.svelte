<script lang="ts">
	import { canCommit, hintLabel, parseEntry, prefillFor, settle } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import Numpad from '$lib/ui/Numpad.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Check from '$lib/ui/icons/Check.svelte';

	/**
	 * The active set, expanded in place into an editor.
	 *
	 * One component, rendered identically by both container modes. That is what
	 * makes the focused-vs-list comparison mean anything: everything below the
	 * container is held constant, so the only variable left is how many exercises
	 * are on screen around it.
	 */
	type Props = {
		cursor: SetCursor;
		history: History;
		oncommit: (weight: number, reps: number) => void;
	};

	let { cursor, history, oncommit }: Props = $props();

	const prefill = $derived(prefillFor(cursor, history));
	const hint = $derived(hintLabel(history, cursor));

	/**
	 * Live values, owned here rather than inside the two fields, because there
	 * are two ways in — the arms and the pad — and they have to agree. Null means
	 * there was nothing to recall and the user has not said otherwise yet; the
	 * check stays inert until both are answered.
	 *
	 * Derived and then reassigned: an edit overrides the recalled value, and a
	 * new prefill — a new set — takes the override back without anything having
	 * to remember to clear it. Written as `$state` seeded once, this would go
	 * stale the moment the parent forgot to key the component.
	 *
	 * `StepperField` holds none of this. It renders `value` and proposes the next
	 * one; `prefill` goes down beside it as `recalled` so the touched dot answers
	 * to what the set opened at rather than to what was typed a keystroke ago.
	 */
	let weight = $derived(prefill.weight);
	let reps = $derived(prefill.reps);

	let pad = $state<'weight' | 'reps' | null>(null);

	const live = $derived(canCommit(weight, reps));

	// Which value is missing is worth saying. "Enter a weight to log" under a rep
	// field the user already filled reads as though the app lost the entry.
	const inertLabel = $derived(weight === null ? 'Enter a weight to log' : 'Enter reps to log');

	function commit() {
		if (weight === null || reps === null) {
			return;
		}

		oncommit(weight, reps);
	}

	// The pad confirms its placeholder when nothing was typed, so an accidental
	// open-and-confirm keeps the value rather than zeroing it. An unparseable
	// string — the empty placeholder of a set with no history — is not a claim,
	// which is the same rule the stepper's own input applies to a typed value.
	function padConfirm(raw: string) {
		const parsed = parseEntry(raw);

		if (parsed !== null) {
			if (pad === 'weight') {
				weight = settle(parsed);
			} else {
				reps = Math.round(settle(parsed));
			}
		}

		pad = null;
	}
</script>

<div class="relative overflow-hidden card-active">
	<div class="absolute inset-y-0 left-0 w-1.5 bg-accent-text" aria-hidden="true"></div>

	<div class="flex flex-col gap-3 py-3 pr-3 pl-4">
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<SetMark status="active" index={cursor.workingIndex + 1} />
				<span class="label-caps">
					{cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`}
				</span>
			</div>

			<!-- Recall, never coaching: what happened last time, stated and left alone. -->
			<span class="text-sm font-bold text-ink-faint">
				{hint === null ? 'First time' : `Last ${hint}`}
			</span>
		</div>

		{#if pad !== null}
			<!-- Keyed so switching fields mounts a clean pad: the buffer only clears
			     on confirm, and digits typed for a weight must not follow the user
			     into the rep field. -->
			{#key pad}
				<Numpad
					label={pad === 'weight' ? 'Weight (kg)' : 'Reps'}
					placeholder={String((pad === 'weight' ? weight : reps) ?? '')}
					maxLength={pad === 'weight' ? 6 : 3}
					fieldSwitchLabel={pad === 'weight' ? 'REPS' : 'KG'}
					onconfirm={padConfirm}
					onfieldswitch={() => (pad = pad === 'weight' ? 'reps' : 'weight')}
					onclose={() => (pad = null)}
				/>
			{/key}
		{:else}
			<div class="grid grid-cols-2 gap-2">
				<StepperField
					label="kg"
					value={weight}
					recalled={prefill.weight}
					step={2.5}
					onchange={(v) => (weight = v)}
					ontype={() => (pad = 'weight')}
				/>
				<StepperField
					label="reps"
					value={reps}
					recalled={prefill.reps}
					step={1}
					onchange={(v) => (reps = Math.round(v))}
					ontype={() => (pad = 'reps')}
				/>
			</div>

			<Button variant="commit" disabled={!live} class="w-full" onclick={commit}>
				{#if live}
					<Check size={30} />
					Log set
				{:else}
					{inertLabel}
				{/if}
			</Button>
		{/if}
	</div>
</div>
