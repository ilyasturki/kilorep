<script lang="ts">
	import { catalog, catalogById } from '$lib/catalog';
	import { MUSCLES } from '$lib/domain/exercise';
	import type { Exercise, Muscle } from '$lib/domain/exercise';
	import type { MainVariants } from '$lib/domain/preference';
	import ExerciseList from '$lib/exercises/ExerciseList.svelte';
	import { similarTo } from '$lib/exercises/browse';
	import type { LastPerformed } from '$lib/store/derive';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import SearchField from '$lib/ui/SearchField.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	/**
	 * The catalog behind a search field and a muscle rail, one tap to pick.
	 *
	 * Two questions, one sheet: which exercises to add, and which one to swap an
	 * entry for. They differ in the title, in what the screen does with the
	 * answer, in what sits at the top of the list — and, since `multiple`, in
	 * whether a tap is the answer or part of one. Still one component: a second
	 * copy would be a second search field to keep in step with the first.
	 *
	 * The same `ExerciseList` the Exercises screen uses — browse folded by
	 * family, search flat and ranked — with the rows picking instead of
	 * navigating. Tapping a family row takes the canonical parent immediately;
	 * the variants sit behind the same expander as everywhere else. In-gym
	 * rule: the common case is one tap after typing three letters.
	 *
	 * The rail is what the Exercises screen does not need and this sheet does.
	 * There, the muscle sections *are* the page and scrolling to one is free;
	 * here they sit inside a panel that opens over a live session, where the
	 * scroll is the friction and a chip is the way past it. It is the second
	 * half of the same act as the search field, so it sits directly under it.
	 */
	type Props = {
		open?: boolean;
		title: string;
		/**
		 * The exercise this pick will replace, which turns the sheet's browse
		 * posture into an answer rather than a catalog: `similarTo` shelves a
		 * handful of substitutes above the muscle sections. Null for an insert —
		 * nothing is being replaced, so there is nothing to be similar to.
		 */
		replacing?: Exercise | null;
		/**
		 * The exercises this user actually trains, most-trained first — the
		 * insert's answer to the same problem `replacing` solves for a swap. See
		 * `frequentFrom`: a catalog that opens on Chest is a catalog you scroll,
		 * and eight rows is most sessions' whole list.
		 *
		 * Ids rather than exercises, because the store that counts them knows
		 * nothing of the catalog. Anything it cannot resolve is dropped rather
		 * than drawn as a gap.
		 */
		frequent?: string[];
		/**
		 * Whether a tap answers or accumulates. An insert takes any number — an
		 * empty session is a day's worth of movements checked off and committed
		 * once — and a swap takes exactly one, because a second pick would not be
		 * a second swap, it would be the same entry replaced twice.
		 */
		multiple?: boolean;
		/** Straight through to the list, which renders it under each name. */
		lastPerformed: LastPerformed;
		/** Straight through to the list, which reseats each family around it. */
		mains: MainVariants;
		/**
		 * The answer, always a list even when the sheet only allows one: one shape
		 * for both postures beats a callback whose arity the caller has to work out
		 * from the props it passed.
		 */
		onpick: (exerciseIds: string[]) => void;
	};

	let {
		open = $bindable(false),
		title,
		replacing = null,
		frequent = [],
		multiple = false,
		lastPerformed,
		mains,
		onpick
	}: Props = $props();

	/**
	 * What rides above the muscle sections, and it is one thing or the other:
	 * both at once would be two shortcuts arguing about which the user meant, and
	 * a swap has already been asked a narrower question than "what do you train".
	 */
	const shelf = $derived.by(() => {
		if (replacing !== null) {
			return { title: 'Similar', exercises: similarTo(catalog, replacing) };
		}

		const exercises = frequent
			.map((id) => catalogById[id])
			.filter((exercise) => exercise !== undefined);

		return exercises.length === 0 ? null : { title: 'Trained most', exercises };
	});

	let query = $state('');

	/**
	 * The muscle rail's pick, empty for none — `''` is what a single-select
	 * ToggleGroup holds when nothing is on, and the list wants a `Muscle` or
	 * null, so the two meet here rather than in a component that would have to
	 * know about both.
	 *
	 * Search answers the "which exercise" question and this answers "which
	 * kind", and the two compose: three letters and a lit chip is the shortest
	 * route through a catalog that will keep growing. Nothing is lit on open —
	 * the sheet is asked to show everything, and a filter the user did not set
	 * is one they have to notice before they can undo it.
	 */
	let muscle = $state('');

	const narrowed = $derived(muscle === '' ? null : (muscle as Muscle));

	/**
	 * The picks so far, in the order they were made — which is the order they
	 * will be performed in, so it is the order the session is built in.
	 *
	 * An array and not a `Set` because that order is the whole point; the `Set`
	 * handed to the list is derived from it, so membership stays a lookup rather
	 * than a scan per row.
	 */
	let picks = $state<string[]>([]);

	const picked = $derived(new Set(picks));

	// Every question the sheet holds, reset together: the next opening is a new
	// one. A muscle left lit would silently narrow an insert made twenty minutes
	// later, and a pick left checked would add an exercise nobody asked for.
	function reset() {
		query = '';
		muscle = '';
		picks = [];
	}

	/**
	 * A tap. Single-answer, it *is* the answer and the sheet closes behind it —
	 * the swap's behaviour, unchanged, and the reason a swap is still two taps.
	 * Collecting, it toggles: same row, same tap, so a mis-tap costs exactly what
	 * it should.
	 */
	function choose(exercise: Exercise) {
		if (!multiple) {
			onpick([exercise.id]);
			reset();
			open = false;

			return;
		}

		picks = picks.includes(exercise.id)
			? picks.filter((id) => id !== exercise.id)
			: [...picks, exercise.id];
	}

	function commit() {
		onpick(picks);
		reset();
		open = false;
	}

	// Dismissing is not committing: a sheet flicked away has to leave the session
	// exactly as it found it, and picks that outlived the panel would arrive at
	// the next opening as checks nobody remembers making.
	$effect(() => {
		if (!open) {
			reset();
		}
	});

	const label = $derived(picks.length === 1 ? 'Add 1 exercise' : `Add ${picks.length} exercises`);
</script>

<!-- Handed to the sheet only once something is picked, rather than rendering
     nothing while empty: the foot draws a hairline and claims its padding for
     whatever it is given, and an empty bar would be chrome describing a state
     the list above already makes obvious. A sheet with no picks is dismissed,
     not completed. -->
{#snippet addBar()}
	<Button variant="commit" class="w-full" onclick={commit}>{label}</Button>
{/snippet}

<Sheet bind:open {title} footer={multiple && picks.length > 0 ? addBar : undefined}>
	<div class="flex flex-col gap-3">
		<SearchField label="Search exercises" bind:value={query} />

		<!-- Bled to the panel's edges so the rail scrolls the full width of the
		     sheet: inset by the body's own padding it would look like a list that
		     had been cut short rather than one that keeps going. `-mx-4` lands the
		     scroll box exactly on the padding edge, which is where the sheet clips
		     anyway, so nothing new can overflow. -->
		<ChipGroup bind:value={muscle} layout="row" label="Filter by muscle" class="-mx-4 px-4">
			{#each MUSCLES as name (name)}
				<Chip value={name}>{name}</Chip>
			{/each}
		</ChipGroup>

		<ExerciseList
			{query}
			muscle={narrowed}
			{shelf}
			{lastPerformed}
			{mains}
			selected={multiple ? picked : undefined}
			onpick={choose}
		/>
	</div>
</Sheet>
