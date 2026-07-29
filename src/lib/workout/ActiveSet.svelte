<script lang="ts">
	import { canCommit, hintLabel, prefillFor } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { tapCommit } from '$lib/ui/haptics';
	import SetMark from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Check from '$lib/ui/icons/Check.svelte';

	/**
	 * The active set, expanded in place into an editor.
	 *
	 * One shape, always: the set, two fields, the commit bar. Tapping a number
	 * used to swap both fields and the bar for a custom key grid, so the single
	 * control the whole loop is built around blinked out of existence mid-edit
	 * and came back as a different element. Typing is the field's own input and
	 * the system keyboard now; nothing here transforms into anything.
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
	 * are two ways in — the arms and the keyboard — and they have to agree. Null
	 * means there was nothing to recall and the user has not said otherwise yet;
	 * the check stays inert until both are answered.
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

	const live = $derived(canCommit(weight, reps));

	// Which value is missing is worth saying. "Enter a weight to log" under a rep
	// field the user already filled reads as though the app lost the entry.
	const inertLabel = $derived(weight === null ? 'Enter a weight to log' : 'Enter reps to log');

	let card = $state<HTMLElement | null>(null);

	function commit() {
		if (weight === null || reps === null) {
			return;
		}

		// After the guard, so a press on an inert check stays silent — a buzz for
		// a set that was not logged is the app claiming something it did not do.
		tapCommit();
		oncommit(weight, reps);
	}

	/**
	 * The system keyboard takes the bottom of the screen, and what sits there is
	 * the commit bar — the target of the very next tap. Bringing the card's
	 * bottom edge up on focus is what keeps it in reach, and it is the reason
	 * this screen can hand typing back to the OS at all.
	 *
	 * `focusin` on the card rather than a prop on each field: it bubbles, so
	 * there is no second copy of the rule to keep in step with the first.
	 */
	function reveal() {
		card?.scrollIntoView({ block: 'end', behavior: 'smooth' });
	}

	/**
	 * Enter logs the set.
	 *
	 * From a field, the input's own handler has already blurred — and blur
	 * settles the draft — by the time this runs, so what lands is the typed
	 * value and not the one it replaced. From nothing in particular, which is a
	 * desk, it logs the set as it stands: Enter, Enter, Enter down a session
	 * whose hints are already right.
	 *
	 * Everything else keeps its own Enter. A focused button activates, and an
	 * open sheet holds focus inside itself, so neither reaches this test.
	 */
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

<div bind:this={card} onfocusin={reveal} class="relative scroll-mb-3 overflow-hidden card-active">
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

		<div class="grid grid-cols-2 gap-2">
			<StepperField
				label="kg"
				value={weight}
				recalled={prefill.weight}
				step={2.5}
				onchange={(v) => (weight = v)}
			/>
			<StepperField
				label="reps"
				value={reps}
				recalled={prefill.reps}
				step={1}
				onchange={(v) => (reps = Math.round(v))}
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
	</div>
</div>
