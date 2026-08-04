<script lang="ts">
	import type { SetCursor } from '$lib/domain/workout';
	import Button from '$lib/ui/Button.svelte';
	import { revealEnd } from '$lib/ui/scroll';
	import SetMark from '$lib/ui/SetMark.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import More from '$lib/ui/icons/More.svelte';

	/**
	 * A set of a finished workout, expanded in place into an editor.
	 *
	 * `ActiveSet`'s counterpart, and deliberately not that component wearing a
	 * flag. The gym card is built around two things neither of which survives
	 * here: the check — inert until both numbers are answered, and what it claims
	 * is that the set happened — and the recall line beside it. In history the
	 * claim belongs to the disc on the row, so this bar only collapses the card;
	 * and "last time" as of today was not what was true the day this was lifted,
	 * so nothing is recalled at all. A variant flag would have hidden both
	 * differences inside the one file hard rule 7 answers to alone.
	 *
	 * The dress is identical because the pieces are the same ones: `card-active`,
	 * the accent edge, `SetMark`, two `StepperField`s.
	 */
	type Props = {
		cursor: SetCursor;
		/**
		 * The weight arms' increment, the same equipment rule the gym card gets —
		 * `weightStep` in `$lib/domain/exercise`, looked up by `WorkoutSection`,
		 * which is the holder of the catalog meta here. A dumbbell set corrected
		 * a day later steps in the same jumps it was lifted in.
		 */
		step: number;
		/**
		 * Every nudge and every typed value, on its way to the set.
		 *
		 * Immediately, and uncompleted — the card holds nothing of its own, so the
		 * row behind it shows the same numbers and the autosave sees each one. It
		 * cannot touch `completed`: a corrected set stays exactly as claimed or
		 * unclaimed as it was.
		 */
		ondraft: (weight: number | null, reps: number | null) => void;
		/** The bar. Nothing is written by it — the numbers are already on the set. */
		ondone: () => void;
		/** Handed the ⋯ itself, so the desktop menu can hang from it. */
		onoptions: (anchor: HTMLElement) => void;
	};

	let { cursor, step, ondraft, ondone, onoptions }: Props = $props();

	const weight = $derived(cursor.set.weight);
	const reps = $derived(cursor.set.reps);

	/**
	 * What the set held when this card opened, and the only thing the fields'
	 * touched tint is measured against — the same capture `ActiveSet` makes, for
	 * the same reason: a live reading would chase every keystroke and the tint
	 * could never appear. Here it says "you have changed this one", which is
	 * worth more on a record than it is on a set being logged.
	 *
	 * Captured once. The section keys this component on the set id, so a
	 * different set is a different instance and this is never stale.
	 */
	// svelte-ignore state_referenced_locally
	const opened = { weight: cursor.set.weight, reps: cursor.set.reps };

	let card = $state<HTMLElement | null>(null);

	/**
	 * The system keyboard takes the bottom of the screen and the card goes with
	 * it. `ActiveSet` explains the move at length — including why it is gated
	 * on visibility; a card that types has the same problem wherever it stands.
	 */
	function reveal(event: FocusEvent) {
		if (!(event.target instanceof HTMLInputElement) || card === null) {
			return;
		}

		revealEnd(card);
	}

	/**
	 * Enter closes the card, from a field of this card and from nowhere else: the
	 * ⋯ and the bar are buttons, and Enter on a focused button is already their
	 * own activation — letting it through here as well would open a sheet and
	 * collapse the card out from under it in one press.
	 *
	 * On the window rather than the card, the same placement `ActiveSet` uses: a
	 * `keydown` handler on a plain element is a control without a role, and the
	 * containment test says in one line what a role and a tabindex would have to
	 * lie about.
	 */
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

			<!-- Always visible, like the gym card's and unlike the row's: this card
			     has a header with room, and the sheet behind it is where a set is
			     removed. -->
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

		<div class="grid grid-cols-2 gap-2">
			<StepperField
				label="kg"
				value={weight}
				recalled={opened.weight}
				{step}
				onchange={(v) => ondraft(v, reps)}
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
			/>
		</div>

		<!-- Outlined, not filled. `Button`'s standing rule is one filled button per
		     screen and this one claims nothing — the numbers landed on the set as
		     they were typed, and all this does is put the row back. -->
		<Button variant="secondary" class="w-full" onclick={ondone}>Done</Button>
	</div>
</div>
