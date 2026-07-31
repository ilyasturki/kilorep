<script lang="ts">
	import { canCommit, hintLabel } from '$lib/domain/workout';
	import type { History, SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { tapCommit } from '$lib/ui/haptics';
	import SetMark from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import More from '$lib/ui/icons/More.svelte';

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
		/**
		 * An edit, on its way to the set it belongs to.
		 *
		 * Every nudge and every typed value goes out immediately, uncompleted. The
		 * card holds nothing of its own: what it renders is the set, so leaving
		 * this exercise and coming back finds the numbers still there, and the row
		 * shows them meanwhile in its pending dress.
		 */
		ondraft: (weight: number | null, reps: number | null) => void;
		/**
		 * The same sheet every other row reaches, from the one row that could not.
		 *
		 * Expanding a set used to take its ⋯ away with the row it replaced, which
		 * left the active set as the single set in a session that could not be
		 * removed — while `WorkoutSession.removeSet` carried a paragraph of care
		 * for exactly that case, unreachable.
		 */
		onoptions: () => void;
	};

	let { cursor, history, oncommit, ondraft, onoptions }: Props = $props();

	const hint = $derived(hintLabel(history, cursor));

	/**
	 * Live values, read straight off the set. Null means there was nothing to
	 * recall and the user has not said otherwise yet; the check stays inert until
	 * both are answered.
	 *
	 * The card owns neither. A set the cursor reaches has already been seeded
	 * with its prefill by the session, and every edit goes back out through
	 * `ondraft` — so there is one copy of these two numbers, on the set, and no
	 * way for the card and the row above it to disagree about them.
	 *
	 * `StepperField` holds nothing either. It renders `value` and proposes the
	 * next one; `opened` goes down beside it as `recalled`, so the touched tint
	 * answers to what the set opened at rather than to what was typed a keystroke
	 * ago.
	 */
	const weight = $derived(cursor.set.weight);
	const reps = $derived(cursor.set.reps);

	/**
	 * What this set opened at, and the only thing the touched tint is measured
	 * against.
	 *
	 * Captured once, deliberately not derived: the values below it now change as
	 * the user edits, so a live reading of the same thing would chase every
	 * keystroke and the tint could never appear. `ExerciseBlock` keys this
	 * component on the set id, so a new set is a new instance and this is never
	 * a stale reading of a previous one.
	 */
	// svelte-ignore state_referenced_locally
	const opened = { weight: cursor.set.weight, reps: cursor.set.reps };

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
	 *
	 * Which is also why it has to ask what was focused. The ⋯ button bubbles
	 * through here too and raises no keyboard, so scrolling for it would be the
	 * card jumping out from under a press for no reason at all.
	 */
	function reveal(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement)) {
			return;
		}

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
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-3">
				<SetMark status="active" index={cursor.workingIndex + 1} />
				<span class="label-caps">
					{cursor.workingIndex < 0 ? 'Warmup' : `Set ${cursor.workingIndex + 1}`}
				</span>
			</div>

			<div class="flex shrink-0 items-center gap-1">
				<!-- Recall, never coaching: what happened last time, stated and left alone. -->
				<span class="text-sm font-bold text-ink-faint">
					{hint === null ? 'First time' : `Last ${hint}`}
				</span>

				<!-- Always visible, where `SetRow` shows its own only to a mouse. The
				     row hides it because 44px of height has nothing to spare; this card
				     has a header with room, and hiding it here would leave the phone
				     with no way at all to reach the sheet — long-press is not available,
				     since a `pointerdown` on a ± arm bubbles to this card and the hold
				     that accelerates the stepper would open the sheet on top of it. -->
				<button
					type="button"
					aria-label="Set options"
					onclick={onoptions}
					class="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-lg
						text-ink-faint focus-ring hover:bg-surface-2 active:bg-surface-2"
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
				step={2.5}
				onchange={(v) => ondraft(v, reps)}
			/>
			<StepperField
				label="reps"
				value={reps}
				recalled={opened.reps}
				step={1}
				onchange={(v) => ondraft(weight, Math.round(v))}
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
