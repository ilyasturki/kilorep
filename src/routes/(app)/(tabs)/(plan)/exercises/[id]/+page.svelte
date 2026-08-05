<script lang="ts">
	import { goto } from '$app/navigation';

	import { catalog } from '$lib/catalog';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import { restLabel } from '$lib/domain/rest';
	import { rawPr } from '$lib/domain/stats';
	import { addExercise, PLANNED_SET_COUNT } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import AddToPlanSheet from '$lib/exercises/AddToPlanSheet.svelte';
	import { kin } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel, loadModeNote, ordinal } from '$lib/exercises/label';
	import { restSettings } from '$lib/settings/rest.svelte';
	import RestDurationField from '$lib/settings/RestDurationField.svelte';
	import { getStore } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import { templateTitle } from '$lib/templates/plan';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';
	import { press } from '$lib/ui/press';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import { persistSession } from '$lib/workout/persist.svelte';

	import type { PageProps } from './$types';

	/**
	 * One exercise: what it is, how long it rests, the family around it, the raw
	 * best, the sessions behind it.
	 *
	 * Catalog entries are immutable and customs are a later slice, so nothing
	 * here edits the exercise — the rest override and the note are preference
	 * records of their own, keyed by the slug, which is why a screen over a
	 * read-only catalog can carry controls at all. Everything else is still a
	 * navigation: the family links, and each history entry through to the
	 * workout it came from.
	 *
	 * This screen is the note's only surface, by decision: the logging loop
	 * stays exactly as it was, and nothing about a note reaches the workout
	 * screen, History or a plan card. Reading one mid-session is a tap on the
	 * exercise name and a tap back.
	 *
	 * The est-1RM trend is settled but still absent: charting is decided now
	 * — Progress' sparklines, drawn from the same `estTrend` — and the
	 * trend lands here as its own change, not smuggled into another one.
	 *
	 * History is the store's, derived from finished workouts on the way in.
	 */
	let { data }: PageProps = $props();

	const exercise = $derived(data.exercise);

	fillAppBar(() => ({ title: exercise.name }));

	// One list and no direction: whoever is on screen, the rest of the family is
	// what they might have meant instead, and the parent has no claim to be read
	// differently from a sibling. Hints never cross these rows — the links exist
	// exactly because each one is its own history.
	const family = $derived(kin(catalog, exercise));

	// Oldest first in the data — the order `rawPr` reads; the screen wants
	// latest first.
	const past = $derived(data.past);
	const sessions = $derived(past.toReversed());

	const pr = $derived(rawPr(past));

	const loadNote = $derived(loadModeNote(exercise.loadMode));

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	/**
	 * The three blanks that stand in for set pills on a never-trained exercise.
	 *
	 * Three because that is what a plan starts an exercise with, and uneven
	 * because a row of identical blocks reads as a page still loading — which is
	 * the one thing this card must not be mistaken for.
	 */
	const GHOST_SETS = ['w-18', 'w-16', 'w-16'];

	// Captured once per mount, like `ExerciseList`'s: `12d` is wrong for at most
	// a day, and a navigation remounts this screen.
	const now = Date.now();

	/**
	 * This exercise's own rest, in the three states it actually has.
	 *
	 * `undefined` is no opinion — the Settings default applies and nothing is
	 * stored. `null` is *never rest on this*, the exercise you circuit. A number
	 * is a duration of its own. The first two are different answers and the UI
	 * has to keep them apart: turning the switch off writes never-rest, while
	 * "Use the default" tombstones the record and goes back to having no opinion.
	 */
	const override = $derived(restSettings.overrideFor(exercise.id));

	const rests = $derived(override !== null);
	const effective = $derived(override ?? restSettings.current.seconds);

	const defaultLabel = $derived(restLabel(restSettings.current.seconds * 1000));

	async function write(seconds: number | null | undefined) {
		const store = await getStore();

		await (seconds === undefined
			? restSettings.clearOverride(store, exercise.id)
			: restSettings.setOverride(store, exercise.id, seconds));

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	/**
	 * The one act a never-trained exercise is missing, in the two forms it takes.
	 *
	 * Mid-session it joins the workout on screen; standing still it joins a plan.
	 * The screen used to end at "no history yet", which is a fact and not an
	 * answer: reading it, the way to train the thing you are looking at was to
	 * leave, find the picker, and search for it again by name.
	 *
	 * Nothing is offered when there is no session and no plan to add to — a
	 * picker over an empty list is a dead end with a sheet in front of it.
	 */
	const live = $derived(activeWorkout.session);

	let planOpen = $state(false);
	let planned = $state<Template | null>(null);

	async function addToWorkout() {
		const session = activeWorkout.session;

		if (session === null) {
			return;
		}

		const store = await getStore();

		// The session outlives this page, but the effect that saves it belongs to
		// the workout screen and that screen is not mounted — so the write is
		// this page's to make. `addExercises` puts the cursor on the new set,
		// which is what the pane will land on.
		session.addExercises([exercise.id]);
		persistSession(store, session);

		await goto('/workout/live');
	}

	/**
	 * A new entry at the foot of the plan, three sets, no rep targets — the
	 * editor's own blank, minted the same way, so an exercise added from here is
	 * indistinguishable from one added there.
	 *
	 * Written straight through rather than autosaved: the editor persists on
	 * every keystroke because it is an editor, and this is a single act with a
	 * single write behind it.
	 */
	async function addToPlan(template: Template) {
		const store = await getStore();

		addExercise(template, exercise.id, {
			entry: crypto.randomUUID(),
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: PLANNED_SET_COUNT }, () => crypto.randomUUID())
		});

		await store.saveTemplate(template, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		planned = template;
	}

	/**
	 * The note, and the two states its section has.
	 *
	 * Read from the load once and owned here from mount on, like the template
	 * editor's tree: navigating exercise-to-exercise remounts this page, so the
	 * prop never changes under a live one.
	 */
	// svelte-ignore state_referenced_locally
	const initial = data.note;

	let draft = $state(initial);

	/**
	 * A field only once it is asked for. The catalog is 79 entries and most will
	 * never carry a note, so the resting shape of this section is one dashed row
	 * rather than an empty box on every exercise in the app.
	 */
	let writing = $state(initial !== '');

	/**
	 * What the store was last told. A plain variable and not state — nothing
	 * renders it; it exists so a save can tell a real edit from an effect
	 * re-running, and so the two paths that commit cannot write twice.
	 */
	let saved = initial;

	/** Long enough that a typed word is one record, short enough to beat a back gesture. */
	const SETTLE_MS = 600;

	/**
	 * Trimmed, because trailing space off a soft keyboard is not an edit — and
	 * empty tombstones rather than storing `''`: the absence of the record is
	 * what "no note" means everywhere else, and an empty string would ride sync
	 * forever as a note that is not there.
	 *
	 * `saved` moves before the first `await`, which is what makes this safe to
	 * call from two places at once — the settle timer and the unmount flush race
	 * on every navigation, and the loser sees its own write already claimed.
	 */
	async function commit(text: string) {
		const settled = text.trim();

		if (settled === saved) {
			return;
		}

		saved = settled;

		const store = await getStore();

		await (settled === ''
			? store.clearExerciseNote(exercise.id, Date.now())
			: store.setExerciseNote(exercise.id, settled, Date.now()));

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	/**
	 * Typing settles into a write, the way every other surface here saves — no
	 * button, nothing to forget. The teardown cancels the pending one before the
	 * next keystroke schedules its own, so a sentence costs one record and not
	 * twenty, each of them dirty and each of them synced.
	 */
	$effect(() => {
		const text = draft;

		if (text.trim() === saved) {
			return;
		}

		const timer = setTimeout(() => void commit(text), SETTLE_MS);

		return () => clearTimeout(timer);
	});

	/**
	 * The teardown-only shape, like the template editor's: nothing is read in
	 * the body, so it runs once and the cleanup is the whole point. Leaving
	 * inside the settle window — the Android back gesture, which unmounts —
	 * would otherwise drop the last thing typed on the floor.
	 */
	$effect(() => () => {
		void commit(draft);
	});

	/**
	 * Set by the tap that reveals the field and spent by the field's first
	 * attach. A plain variable so the attachment tracks nothing: read `draft`
	 * there instead and every keystroke would re-run it, stealing the caret back
	 * to the end of the text on each one.
	 */
	let claiming = false;

	function open() {
		claiming = true;
		writing = true;
	}

	/**
	 * The field was asked for, so it takes the caret and the keyboard with it —
	 * a second tap to start typing is the tap this section just charged for.
	 * Arriving at an exercise that already has a note claims neither.
	 */
	function caret(node: HTMLTextAreaElement) {
		if (claiming) {
			claiming = false;
			node.focus();
		}
	}
</script>

<svelte:head>
	<title>{exercise.name} | Kilorep</title>
</svelte:head>

<!-- A family link is a choice between entries, so it reads like a catalog row:
     the line-art thumb, last time's best set beside the name, how long since on
     the right, and nothing at all when the entry has never been trained.
     Spelled here rather than reusing `ExerciseList` — that component is the
     browse-and-search posture, and this section is neither. -->
{#snippet familyRow(entry: Exercise)}
	{@const last = data.lastPerformed[entry.id]}
	{@const since = lastSinceLabel(last, now)}

	{#snippet recency()}{since}{/snippet}

	<!-- The slot is reserved even when the entry has no art, exactly like the
	     catalog rows: a missing thumb must not unalign the one title in the
	     column that lacks it. -->
	{#snippet thumb()}
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={entry.id} name={entry.name} class="size-full" />
		</span>
	{/snippet}

	<ListRow
		title={entry.name}
		meta={lastSetLabel(last)}
		leading={thumb}
		trailing={since === undefined ? undefined : recency}
		href="/exercises/{entry.id}"
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
	<header class="flex flex-col gap-2">
		<!-- The art beside what describes the exercise, vertically centred against
		     it, so neither column floats in space the other left empty. Absent,
		     not reserved, when there is no art: the notes column simply takes the
		     full width. -->
		<div class="flex items-center justify-between gap-4 px-1">
			<div class="flex min-w-0 flex-col gap-2">
				<!-- The name, at the width where the bar stops carrying it: the bar's
				     `<h1>` is the phone's, and above `lg` the tabs take that row — which
				     left this screen showing an illustration and two badges for a lift
				     it never named. Hidden below `lg` rather than moved, because there
				     the bar is already saying it. -->
				<h1 class="hidden text-xl font-extrabold tracking-tight text-ink lg:block">
					{exercise.name}
				</h1>

				<!-- No equipment: the name already carries it wherever it is not the
				     default. What survives is the load mode, and only when there is one
				     — it is the line that says the numbers below count double. -->
				{#if loadNote}
					<p class="text-md font-bold text-ink-faint">{loadNote}</p>
				{/if}

				<div class="flex flex-wrap gap-1.5">
					<Badge tone="accent">{exercise.muscles.primary}</Badge>
					{#each exercise.muscles.secondary as muscle (muscle)}
						<Badge>{muscle}</Badge>
					{/each}
				</div>

				<!-- The best set ever logged, opposite the art rather than in a slab of
				     its own below the fold of the header. It belongs with what describes
				     the exercise: the load mode says how the numbers are counted and the
				     badges say what the lift is, and this is the third fact of the same
				     paragraph.

				     It keeps its border and fill at a smaller scale, sized to its
				     contents — the one measured thing in a column of labels, and a
				     bordered card is how this app has always said so. Wrapping rather
				     than truncating: the column is ~183px beside a 144px illustration on
				     a 375px phone, which `RAW BEST 100 × 5` fits on one line and a
				     four-digit total would not.

				     `label-caps` carries `ink-faint` itself, so the colour is not
				     restated here. -->
				{#if pr !== null}
					<div
						class="flex w-fit flex-wrap items-baseline gap-x-2 rounded-xl border
							border-line-soft bg-surface px-3 py-2"
					>
						<span class="label-caps">Raw best</span>
						<span class="text-md font-extrabold tracking-tight">
							{pr.set.weight} × {pr.set.reps}
						</span>
					</div>
				{/if}
			</div>

			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-36 shrink-0" />
		</div>
	</header>

	<!-- Hidden entirely while rest is switched off in Settings — a duration for a
	     timer that never runs is a question with no consequence. -->
	{#if restSettings.current.enabled}
		<section class="flex flex-col gap-3">
			<h2 class="px-3 label-caps">Rest</h2>

			<div class="flex flex-col gap-3 px-3">
				<Switch
					label="Rest on this exercise"
					description={rests
						? 'A countdown starts when a working set is logged'
						: 'No countdown — this one is never timed'}
					bind:checked={() => rests, (next) => void write(next ? effective : null)}
				/>

				{#if rests}
					<RestDurationField
						label="Duration"
						description={override === undefined
							? `The ${defaultLabel} default`
							: 'This exercise only'}
						seconds={effective}
						onchange={(next) => void write(next)}
					/>

					{#if override !== undefined}
						<Button variant="secondary" onclick={() => void write(undefined)}>
							Use the default ({defaultLabel})
						</Button>
					{/if}
				{/if}
			</div>
		</section>
	{/if}

	<!-- Below Rest and above the family, which is the order this screen is read
	     in: what the lift is, how it is timed, what you wrote about it, what else
	     it could have been, what you have done.

	     No `label-caps` heading of its own in either state, unlike the sections
	     around it. Written, the field's own label is that heading — same class,
	     same gutter, same place — and a `Note` over a box labelled `Note` was the
	     word twice. Empty, the dashed row says what it does, exactly like the
	     `Add set` and `+ New template` rows elsewhere, which carry no heading
	     either. -->
	<section class="flex flex-col px-3">
		{#if writing}
			<!-- `onblur` and the settle timer both commit; whichever lands first
			     claims the write. Dismissing the keyboard is the moment a note feels
			     finished, and waiting out 600ms after it would be a lie. -->
			<Textarea
				label="Note"
				placeholder="Seat 4 · pin 3 · narrow handles"
				bind:value={draft}
				onblur={() => void commit(draft)}
				{@attach caret}
			/>
		{:else}
			<AddRow label="Add note" icon={Pencil} onclick={open} />
		{/if}
	</section>

	{#if family.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Variants</h2>
			<div class="list-group">
				{#each family as variant (variant.id)}
					{@render familyRow(variant)}
				{/each}
			</div>
		</section>
	{/if}

	<section class="flex flex-col gap-2">
		<h2 class="px-3 label-caps">History</h2>

		{#if sessions.length === 0}
			<!-- The card that is not there yet, drawn as itself: the same rounded
			     block the sessions below wear, dashed and drained of its numbers —
			     a date line and three set pills with nothing in them. A centred
			     glyph in a circle was the house empty state and said only that
			     something was absent; this says what, and where it will appear.

			     No invented numbers in the pills. A ghost `100 × 5` on the one
			     screen whose whole job is telling you what you have lifted is a
			     sentence the page must never be caught saying, however faint. -->
			<div
				class="flex flex-col gap-4 rounded-2xl border-[1.5px] border-dashed border-line
					bg-surface px-3 py-4"
			>
				<div aria-hidden="true" class="flex flex-col gap-2">
					<span class="block h-3 w-28 rounded-full bg-sunken"></span>

					<div class="flex flex-wrap gap-1.5">
						{#each GHOST_SETS as width, index (index)}
							<span class="h-9 rounded-lg bg-sunken {width}"></span>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<p class="title-panel">No history yet</p>
					<p class="text-md font-bold text-ink-faint">
						The first set you log lands here, and the hints stay silent until it does.
					</p>
				</div>

				<!-- One button, whichever of the two acts is available, and none at
				     all when neither is. Settled, it becomes the way into the plan it
				     just joined rather than an offer to join it twice. -->
				{#if live !== null}
					<Button variant="secondary" class="w-full" onclick={() => void addToWorkout()}>
						Add to this workout
					</Button>
				{:else if planned !== null}
					<Button variant="secondary" class="w-full" href="/templates/{planned.id}">
						Added to {templateTitle(planned)}
					</Button>
				{:else if data.plans.length > 0}
					<Button variant="secondary" class="w-full" onclick={() => (planOpen = true)}>
						Add to a plan
					</Button>
				{/if}
			</div>

			<AddToPlanSheet
				bind:open={planOpen}
				templates={data.plans}
				onpick={(template) => void addToPlan(template)}
			/>
		{:else}
			<!-- The same card the family lists above wear. Each entry is one link
			     into the workout it came from — the ordinal says where in that
			     session the exercise sat, and the answer to "what else did I do
			     that day" is one tap, not a hunt through the History tab. -->
			<div class="list-group">
				{#each sessions as session (session.workoutId)}
					<a
						href="/history/{session.workoutId}"
						data-list-row
						class="flex press-sink flex-col gap-2 px-3 py-2.5 focus-ring
							hover:bg-hover pointer-fine:transition-[background-color]
							pointer-fine:duration-100 press:bg-surface-2"
						{@attach press()}
					>
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-ink-faint">
								{day.format(session.date)} · {ordinal(session.position)} exercise
							</span>
							{#if session.date === pr?.date}
								<Badge tone="accent">PR</Badge>
							{/if}
							<span aria-hidden="true" class="ml-auto text-xl leading-none text-ink-faint">
								›
							</span>
						</div>

						<!-- One pill per set, in session order: the weight is the loud
						     number, the reps ride it muted — the two stopped sharing a
						     typeface the day the joined `·` line became unreadable. -->
						<div class="flex flex-wrap gap-1.5">
							{#each session.sets as set, index (index)}
								<span class="inline-flex items-baseline gap-1 rounded-lg bg-sunken px-2.5 py-1.5">
									<span class="text-md font-extrabold tracking-tight">{set.weight}</span>
									<span class="text-sm font-bold text-ink-faint">×{set.reps}</span>
								</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</main>
