<script lang="ts">
	import type { Snippet } from 'svelte';
	import { weightStep } from '$lib/domain/exercise';
	import type { Exercise } from '$lib/domain/exercise';
	import type { SetCursor } from '$lib/domain/workout';
	import EditSet from '$lib/history/EditSet.svelte';
	import { loadModeNote } from '$lib/exercises/label';
	import Badge from '$lib/ui/Badge.svelte';
	import SetMark from '$lib/ui/SetMark.svelte';
	import type { SetStatus } from '$lib/ui/SetMark.svelte';
	import More from '$lib/ui/icons/More.svelte';

	/**
	 * One exercise of a past workout, in both of the screen's postures.
	 *
	 * One component and not two, because everything above the rows — the name,
	 * the load-mode note, the drift badges — is the same fact in either posture,
	 * and written twice it would drift the first time a badge changed. What the
	 * posture decides is only what a row *is*: a line to read, or a disc that
	 * claims, a body that opens an editor and a ⋯ that removes.
	 *
	 * Nothing here is the workout screen's. `ExerciseBlock` renders the same
	 * three things for a session in progress, and reaching for it would have meant
	 * a hint slot to suppress, a cursor to fake, and a disc that must become a
	 * button inside a row whose whole surface is already one — all of it inside
	 * the files hard rule 7 answers to.
	 */
	type Props = {
		meta: Exercise;
		/** The entry this exercise was performed under — what a reorder moves. */
		entryId: string;
		cursors: SetCursor[];
		/**
		 * Drift against the template as it stands today, already worded:
		 * `Unplanned`, `+1 set`, `target moved`. Empty when the session matched its
		 * plan, and empty when there was never a plan to hold it against.
		 */
		badges: string[];
		editing: boolean;
		/** The set expanded into an editor, when it is one of this exercise's. */
		openSetId: string | null;
		onopen: (setId: string) => void;
		onclose: () => void;
		ondraft: (setId: string, weight: number | null, reps: number | null) => void;
		/** The disc: claim this set, or take the claim back. */
		ontoggle: (setId: string) => void;
		onoptions: (setId: string) => void;
		/** The name: swap what was performed here, or take it out of the record. */
		onexercise: () => void;
		onadd: () => void;
		/**
		 * The drag handle, owned by the screen — this is one draggable unit, and
		 * the gesture belongs to the list that holds the order. Handed the entry id
		 * so the screen can declare one handle for every section: a snippet
		 * declared inside the `{#each}` would leave the animated wrapper with a
		 * sibling, which `animate:` forbids.
		 */
		grip?: Snippet<[string]>;
	};

	let {
		meta,
		entryId,
		cursors,
		badges,
		editing,
		openSetId,
		onopen,
		onclose,
		ondraft,
		ontoggle,
		onoptions,
		onexercise,
		onadd,
		grip
	}: Props = $props();

	/**
	 * A warmup stays a warmup once logged — its disc wears a W rather than a
	 * check, the same rule the workout screen keeps, because it was never a
	 * working set and the list must not imply it counted.
	 */
	function statusOf(cursor: SetCursor): SetStatus {
		if (cursor.set.type === 'warmup') {
			return 'warmup';
		}

		return cursor.set.completed ? 'done' : 'pending';
	}

	const note = $derived(loadModeNote(meta.loadMode));
</script>

<!-- The numbers as the session left them, in the one dress both postures share.
     `—` for a set that holds neither, which is every set added while editing
     until it is answered. -->
{#snippet numbers(cursor: SetCursor)}
	<span
		class={[
			'flex-1 text-md tracking-numeral',
			cursor.set.completed ? 'font-extrabold text-ink' : 'font-bold text-ink-faint'
		]}
	>
		{cursor.set.weight !== null && cursor.set.reps !== null
			? `${cursor.set.weight} × ${cursor.set.reps}`
			: '—'}
	</span>

	{#if cursor.set.plannedReps !== null && cursor.set.reps !== cursor.set.plannedReps}
		<span class="shrink-0 text-sm font-bold text-ink-faint">
			planned {cursor.set.plannedReps}
		</span>
	{/if}
{/snippet}

{#snippet heading()}
	<h2 class="truncate text-lg font-extrabold tracking-tight text-ink">{meta.name}</h2>
	<!-- The load mode and nothing else: the sets below are the record of the day,
	     and this line exists only to say when their numbers count double. -->
	{#if note}
		<p class="truncate text-sm font-bold text-ink-faint">{note}</p>
	{/if}
{/snippet}

<section class="flex flex-col gap-2 rounded-2xl border border-line-soft bg-surface p-3">
	<div class="flex items-center gap-2">
		{#if editing}
			<!-- The name is the button and the whole heading is its target, exactly as
			     on the workout screen: what a tap is about is the exercise, and the
			     sheet it opens is titled with the name the thumb landed on. -->
			<button
				type="button"
				onclick={onexercise}
				class="min-w-0 flex-1 rounded-xl px-1 py-1 text-left focus-ring hover:bg-surface-2
					active:bg-surface-2"
			>
				{@render heading()}
			</button>
		{:else}
			<div class="min-w-0 flex-1 px-1">
				{@render heading()}
			</div>
		{/if}

		{#each badges as badge (badge)}
			<Badge>{badge}</Badge>
		{/each}

		{@render grip?.(entryId)}
	</div>

	{#each cursors as cursor (cursor.set.id)}
		{#if editing && cursor.set.id === openSetId}
			<!-- Keyed on the set id so a different row mounts a fresh editor rather
			     than mutating the open one underneath the user's thumb. -->
			{#key cursor.set.id}
				<EditSet
					{cursor}
					step={weightStep(meta.equipment)}
					ondraft={(weight, reps) => ondraft(cursor.set.id, weight, reps)}
					ondone={onclose}
					onoptions={() => onoptions(cursor.set.id)}
				/>
			{/key}
		{:else if editing}
			<div class="flex min-h-11 items-center gap-1">
				<!-- The disc is the claim, so in this posture it is the control that
				     makes and unmakes one. Not for a warmup: `SetMark` draws a W either
				     way, warmups count toward nothing anywhere in the app, and a button
				     that changes neither the screen nor the data is worse than none. -->
				{#if cursor.set.type === 'warmup'}
					<div class="grid size-11 shrink-0 place-items-center">
						<SetMark status="warmup" />
					</div>
				{:else}
					<button
						type="button"
						aria-label="{cursor.set.completed ? 'Unmark' : 'Mark'} set {cursor.workingIndex +
							1} as done"
						onclick={() => ontoggle(cursor.set.id)}
						class="grid size-11 shrink-0 place-items-center rounded-full focus-ring
							hover:bg-surface-2 active:bg-surface-2"
					>
						<SetMark status={statusOf(cursor)} index={cursor.workingIndex + 1} />
					</button>
				{/if}

				<button
					type="button"
					onclick={() => onopen(cursor.set.id)}
					class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2 text-left focus-ring
						hover:bg-surface-2 active:bg-surface-2"
				>
					{@render numbers(cursor)}
				</button>

				<!-- Always drawn, where `SetRow` shows its own only to a mouse: there is
				     no long-press here to fall back on, and the sheet behind it is the
				     only way a set leaves the record. -->
				<button
					type="button"
					aria-label="Set options"
					onclick={() => onoptions(cursor.set.id)}
					class="grid size-9 shrink-0 place-items-center rounded-lg text-lg text-ink-faint
						focus-ring hover:bg-surface-2 active:bg-surface-2"
				>
					<More size={20} />
				</button>
			</div>
		{:else}
			<div class="flex min-h-11 items-center gap-3 px-1">
				<SetMark status={statusOf(cursor)} index={cursor.workingIndex + 1} />
				{@render numbers(cursor)}
			</div>
		{/if}
	{/each}

	{#if editing}
		<!-- A row's silhouette with nothing in it, the same dashed shape the workout
		     screen grows by. `+` is a character — the icons README is explicit that a
		     glyph Nunito carries never becomes an SVG. -->
		<button
			type="button"
			onclick={onadd}
			class="grid min-h-11 place-items-center rounded-xl border border-dashed border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			<span class="label-caps">+ Add set</span>
		</button>
	{/if}
</section>
