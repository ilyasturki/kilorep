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
		/**
		 * The weight arms' increment, decided by the exercise's equipment —
		 * `weightStep` in `$lib/domain/exercise` is the rule, `ExerciseBlock`
		 * looks it up because it is the one holding the catalog meta. Reps keep
		 * their own ±1 below regardless.
		 */
		step: number;
		oncommit: (weight: number, reps: number) => void;
		/**
		 * An edit, on its way to the set it belongs to.
		 *
		 * Every nudge and every typed value goes out immediately, uncompleted. The
		 * card holds nothing of its own: what it renders is the set, so leaving
		 * this exercise and coming back finds the numbers still there, and the row
		 * shows them meanwhile in its pending dress.
		 *
		 * A null slot is a field the user emptied, and it travels the same road as
		 * any other edit — the session is what makes it stick, by declining to
		 * seed a set someone has taken a number out of.
		 */
		ondraft: (weight: number | null, reps: number | null) => void;
		/**
		 * How hard it was, on its way to the set — null when the rating is taken
		 * back off. Its own channel and not a third slot on `ondraft`, because it
		 * answers to none of that rule's care: it cannot empty the check, it
		 * cannot un-complete a set, and a set holding nothing but a rating is
		 * ordinary rather than a claim about nothing.
		 */
		onrate: (rpe: number | null) => void;
		/**
		 * The same sheet every other row reaches, from the one row that could not.
		 *
		 * Expanding a set used to take its ⋯ away with the row it replaced, which
		 * left the active set as the single set in a session that could not be
		 * removed — while `WorkoutSession.removeSet` carried a paragraph of care
		 * for exactly that case, unreachable.
		 */
		/** Handed the ⋯ itself, so the desktop menu can hang from it. */
		onoptions: (anchor: HTMLElement) => void;
	};

	let { cursor, history, step, oncommit, ondraft, onrate, onoptions }: Props = $props();

	// The recall line grows how last time felt, where last time said: `82.5 × 7 ·
	// RPE 8`. Read from the holder rather than passed down, because the word is a
	// preference and every screen that prints it reads the same one.
	const hint = $derived(hintLabel(history, cursor, exertionScale.current));

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

	/**
	 * What each field is worth mid-keystroke, before blur settles it.
	 *
	 * The commit bar used to read only settled values, so it sat inert while
	 * both numbers were plainly on screen — and the tap meant to log them blurred
	 * the field into a still-disabled button and was swallowed, which turned the
	 * one-tap commit into two. `undefined` is "not being typed in", and it is
	 * distinct from null on purpose: null is a field the user emptied, a real
	 * preview the bar must go inert for.
	 *
	 * Only the bar reads these. The set still learns values on blur, so the row
	 * above, the rail and everything else keep updating exactly when they did.
	 */
	let previewWeight = $state<number | null | undefined>();
	let previewReps = $state<number | null | undefined>();

	const liveWeight = $derived(previewWeight === undefined ? weight : previewWeight);
	// Rounded like `ondraft` rounds, so the bar never goes live for a "0.4"
	// that blur would land as zero reps.
	const liveReps = $derived.by(() => {
		if (previewReps === undefined) {
			return reps;
		}

		return previewReps === null ? null : Math.round(previewReps);
	});

	const live = $derived(canCommit(liveWeight, liveReps));

	/**
	 * Blur has already landed the draft on the set by the time this bubbles up —
	 * `StepperField` commits in its own `onblur` first — so dropping the preview
	 * here hands the bar back to the settled values it just previewed. Without
	 * this, a ± tap after typing would update the set while the bar kept reading
	 * the stale preview.
	 */
	function settlePreviews() {
		previewWeight = undefined;
		previewReps = undefined;
	}

	// Which value is missing is worth saying. "Enter a weight to log" under a rep
	// field the user already filled reads as though the app lost the entry.
	const inertLabel = $derived(liveWeight === null ? 'Enter a weight to log' : 'Enter reps to log');

	/**
	 * The disc says what the set *is*; the card says where the cursor is.
	 *
	 * It used to be hardcoded `active`, which made the editor the one place in
	 * the app where a set stopped showing its own state — reopening a logged set
	 * to fix a number took its check away.
	 *
	 * The warmup branch is ahead of its use. Nothing mints a warmup today: every
	 * set-creating path writes `normal`, and set type is parked behind the ⋯ with
	 * RPE and note. It is here because the hardcoded status hid a second thing
	 * besides the check — `workingIndex` is -1 for a warmup, so the disc's
	 * `index` is 0, and the day set type lands the active warmup would draw a
	 * `0`. One rule answers both, and only one of them can be seen yet.
	 *
	 * Nothing is lost by giving the ring up. `card-active` already carries the
	 * accent border and the 6px rail down the left edge, and it is the only card
	 * on the screen wearing either — the cursor was never in doubt from a 32px
	 * disc.
	 */
	const status = $derived.by<SetStatus>(() => {
		if (cursor.set.type === 'warmup') {
			return 'warmup';
		}

		return cursor.set.completed ? 'done' : 'active';
	});

	/**
	 * `Update set` for a set that has already been logged, `Log set` for one that
	 * has not.
	 *
	 * The act behind the button is identical either way — `commitSet` writes the
	 * pair and claims the set, whether or not it was claiming already — but the
	 * word is not. Beside a disc wearing a check, "Log set" is the card offering
	 * to do a thing it has just finished saying was done.
	 */
	const commitLabel = $derived(cursor.set.completed ? 'Update set' : 'Log set');

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
	 * `revealEnd` and not a bare `scrollIntoView`: the scroll only happens when
	 * some of the card is actually off screen. Unconditional, it also ran at a
	 * desk — every click into a field bottom-aligned the card and slid the page
	 * under the pointer for nothing. The keyboard case survives the gate, and
	 * `revealEnd` says how.
	 *
	 * `focusin` on the card rather than a prop on each field: it bubbles, so
	 * there is no second copy of the rule to keep in step with the first.
	 *
	 * Which is also why it has to ask what was focused. The ⋯ button bubbles
	 * through here too and raises no keyboard, so scrolling for it would be the
	 * card jumping out from under a press for no reason at all.
	 */
	function reveal(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement) || card === null) {
			return;
		}

		revealEnd(card);
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
			<!-- Null passes straight through rather than being rounded: it is the
			     field emptied, and `Math.round(null)` is a rep count of zero the
			     user never entered. -->
			<StepperField
				label="reps"
				value={reps}
				recalled={opened.reps}
				step={1}
				onchange={(v) => ondraft(weight, v === null ? null : Math.round(v))}
				onpreview={(v) => (previewReps = v)}
			/>
		</div>

		<!-- The rating rides on the commit bar's line rather than owning one of its
		     own. A line to itself cost the card 56px and spent them pushing the
		     target of the very next tap that much further down — rule 7's exact
		     complaint, paid on every set whether or not anyone rates it — and left
		     the pill stranded on a line that was otherwise empty.

		     Wrapping, because the picker opens into a full-width control: the chips
		     and the stepper carry `basis-full`, which takes the line and puts the
		     bar back underneath while they are up. -->
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
