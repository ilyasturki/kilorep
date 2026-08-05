<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { drawableMark, isArchived, startFrom } from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { formatWhen, workoutMeta, workoutTitle } from '$lib/history/label';
	import { launchRepeat } from '$lib/history/repeat';
	import WorkoutRowMenu from '$lib/history/WorkoutRowMenu.svelte';
	import { syncSoon } from '$lib/sync/client';
	import { planLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';

	import type { Template } from '$lib/domain/template';
	import type { Workout } from '$lib/domain/workout';
	import type { PageProps } from './$types';

	/**
	 * Home with nothing running: the place a workout begins, and nothing else.
	 *
	 * It shared an address with the loop for a while, one screen with two
	 * postures, and the argument for that was a good one — a `/start` page had
	 * existed before and lied, because its reroute knew only the in-memory
	 * holder and a reload left it offering to start a workout that was already
	 * half logged. What killed that argument is `(app)/+layout.ts`: the holder is
	 * refilled from the snapshot before any page load runs, so a guard reading it
	 * can no longer be wrong. Two addresses, one true at a time, each stating the
	 * other's rule — see this route's `+page.ts` and the loop's.
	 *
	 * What the split buys is that neither screen has to be written as the absence
	 * of the other. This one is a start button over two glances — the plans you
	 * wrote and the sessions you already did; the loop is the loop. Nothing in
	 * either is behind a branch on which one you meant.
	 *
	 * Both glances answer the same question in the two ways a lifter asks it: by
	 * the plan, and by "the one I did last time". The second is why History is
	 * reachable from here at all — it used to be Progress' child alone, one card
	 * deep on another tab, which is a long way to walk to repeat Monday.
	 *
	 * And it is written as a screen rather than as an empty state, which it was.
	 * `EmptyState` is what a screen shows *before it has anything to show*, and
	 * this one always has the only thing it is for: a way to begin. Drawn as one
	 * it centred a title reading "No workout running" — the tab introducing
	 * itself by what is absent — and the templates had to ride inside the action slot,
	 * a left-aligned list inside a centred block, undoing the centring on the way
	 * past. The start is at the foot now, where the template editor's Start and
	 * History's Repeat already are: the same act in the same corner, under the
	 * thumb, however far the list above it grows.
	 *
	 * Nothing begins until a tap says so. A session minted by navigation was how
	 * "Resume workout" appeared over a workout nobody had started, and the rule
	 * survives the split unchanged: the `+page.ts` beside this file picks up a
	 * *handoff* — a snapshot another screen wrote on purpose — and never invents
	 * one.
	 */
	let { data }: PageProps = $props();

	/**
	 * Begin, then go. Both in that order and both here rather than in a load,
	 * because starting is an act and a load is a reading: the holder is what the
	 * next address is guarded on, so it has to be full before the navigation
	 * rather than as a consequence of it.
	 */
	async function startEmpty() {
		activeWorkout.begin(data.history);

		await invalidate(SESSION_DEP);
		await goto('/workout/live');
	}

	/**
	 * A template row begins the workout there and then — the same copy-on-start
	 * the editor's Start performs, minus its discard dialog, which guarded a live
	 * session this screen's existence is the proof there isn't.
	 *
	 * PRODUCT.md retires tap-to-start on the Templates *tab*, where a row also
	 * means "open this plan". Here a row can mean nothing else: starting is this
	 * screen's whole job, the heading over the list says so, and the tab keeps
	 * the editor route for reading.
	 */
	async function startTemplate(template: Template) {
		const workout = startFrom(template, Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(workout);

		activeWorkout.begin(data.history, {
			workout,
			activeSetId: first === null ? null : first.set.id
		});

		await invalidate(SESSION_DEP);
		await goto('/workout/live');
	}

	/**
	 * Repeat-as-resume, the same call History's list and a workout's own ⋯ make.
	 * The gate they wrap it in — a live session or a snapshot that starting over
	 * would destroy — cannot fire here: this address redirects to `/workout/live`
	 * whenever the holder is full, and its load claims any snapshot waiting on
	 * the way in. A screen that exists is the proof there is nothing to discard.
	 */
	async function repeat(workout: Workout) {
		await launchRepeat(data.store, workout);
	}

	/**
	 * Archived plans are gone from here, which is most of what archiving is for:
	 * this is the mid-stride glance, and a list you have stopped training from
	 * is exactly the noise it exists to take out.
	 */
	const startable = $derived(data.templates.filter((template) => !isArchived(template)));

	/** Both glances stay glances, not pages: the tabs hold the rest. */
	const idleTemplates = $derived(startable.slice(0, 4));

	// Newest first, which is the order the question is asked in — "what did I do
	// last time" long before "what did I do in March".
	const recent = $derived(data.workouts.toReversed().slice(0, 4));

	// Captured once per mount, the idiom every dated list here uses: a screen
	// left open across midnight keeps yesterday's wording until you navigate.
	const now = Date.now();

	/**
	 * A held row, and the two things it can do that a tap cannot. Open, because
	 * here a tap begins rather than reads. Delete, because the row is the same
	 * record History's list holds and the gesture had better mean the same thing
	 * on both — including its confirmation: a tombstone travels to every device.
	 */
	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);
	let held = $state<Workout | null>(null);
	let deleteOpen = $state(false);

	function hold(anchor: HTMLElement, workout: Workout) {
		held = workout;
		menuAnchor = anchor;
		menuOpen = true;
	}

	async function remove() {
		if (held === null) {
			return;
		}

		await data.store.deleteWorkout(held.id, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}

		// The list is the load's own data, so it has to be told — the row has to
		// leave the screen under the finger that deleted it.
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
		{#if startable.length === 0 && recent.length === 0}
			<!-- The whole of what this screen has to say before there is a plan to
			     name or a session to repeat: one line, no icon, no second button.
			     The act is at the foot where it always is, and a graphic over an
			     empty pane would be decoration on the one screen that opens every
			     session. It goes the moment either glance below has something —
			     including for the lifter who never writes a template, whose whole
			     history is the list further down. -->
			<p class="px-3 text-md font-bold text-ink-faint">Start empty and build as you go.</p>
		{/if}

		{#if startable.length > 0}
			<section class="flex flex-col gap-2">
				<!-- The heading is what makes a tap on a row unambiguous. On the
				     Templates tab the same row opens a plan, and PRODUCT.md is
				     deliberate that one row cannot honestly carry both meanings —
				     here it carries one, and this says which. -->
				<h2 class="px-3 label-caps">Start from a template</h2>

				<div class="list-group">
					{#each idleTemplates as template (template.id)}
						{@const mark = drawableMark(template)}

						{#snippet tile()}
							{#if mark !== null}
								<TemplateMark {mark} />
							{/if}
						{/snippet}

						<!-- Named movements rather than a count, `planLine`'s doing and the
						     Templates tab's verbatim: the two screens print the same plan and
						     have to word it identically, which is why the wording is one
						     function in `plan.ts` now rather than a copy here and a comment
						     saying it must not drift. It earns more on this screen than on
						     that one — a row here *starts* the session, and what is in the
						     plan is the whole of what the choice turns on. -->
						<ListRow
							title={templateTitle(template)}
							meta={planLine(template, catalogById)}
							stacked
							chevron={false}
							leading={mark === null ? undefined : tile}
							onclick={() => void startTemplate(template)}
						/>
					{/each}
				</div>

				<!-- Outside the card on purpose, the arrangement the Templates tab
				     already uses: inside it this would be a fifth row that looked
				     like a plan and started nothing. -->
				{#if startable.length > idleTemplates.length}
					<ListRow title="See all templates" href="/templates" />
				{/if}
			</section>
		{/if}

		{#if recent.length > 0}
			<!-- Under the plans, because a plan is what you wrote down on purpose and
			     this is what happened; a lifter who has both reads them in that
			     order. Same cap, so neither glance can push Start below the fold. -->
			<section class="flex flex-col gap-2">
				<!-- Says which of the two meanings a row carries, exactly as the
				     heading above it does. In History the identical row opens the
				     record — here it begins a new session from it, and the word
				     "repeat" is the whole of the difference. -->
				<h2 class="px-3 label-caps">Repeat a workout</h2>

				<div class="list-group">
					{#each recent as workout (workout.id)}
						{@const when = formatWhen(workout.startedAt, now)}

						<ListRow
							title={workoutTitle(workout, data.templates)}
							meta={workoutMeta(workout)}
							chevron={false}
							onclick={() => void repeat(workout)}
							onhold={(anchor) => hold(anchor, workout)}
						>
							<!-- Both spellings rendered, one hidden, the way History's list
							     does it: the swap is `lg` and CSS picks, so no width has to
							     be measured. -->
							{#snippet trailing()}
								<span class="lg:hidden">{when.short}</span>
								<span class="hidden lg:inline">{when.long}</span>
							{/snippet}
						</ListRow>
					{/each}
				</div>

				<!-- Always, not only past four, which is where it parts company with
				     the templates row above. That one is an overflow; this one is also
				     History's second front door — hidden until a fifth session, and a
				     lifter with four workouts would never find the screen at all. -->
				<ListRow title="See all workouts" href="/history" />
			</section>
		{/if}

		<!-- Pinned inside the scroll pane, the template editor's Start verbatim:
		     the act stays under the thumb however long the glance above it grows,
		     and the two screens that begin a workout begin it in the same corner.
		     The tab bar below carries the gesture-bar clearance on a phone; from
		     `lg` the pane's own floor is the window's. -->
		<div
			class="sticky bottom-0 -mx-3 mt-auto border-t border-line-soft bg-canvas px-3 py-3
				lg:pb-[max(0.75rem,var(--spacing-safe-b))]"
		>
			<Button variant="commit" class="w-full" onclick={() => void startEmpty()}>
				Start empty workout
			</Button>
		</div>
	</div>
</main>

<!-- No `onrepeat`: the tap on the row already spends that verb, and a menu that
     listed it again would be offering the thing you just declined to do. -->
<WorkoutRowMenu
	bind:open={menuOpen}
	title={held === null ? '' : workoutTitle(held, data.templates)}
	anchor={menuAnchor}
	href={held === null ? undefined : `/history/${held.id}`}
	ondelete={() => (deleteOpen = true)}
/>

<AlertDialog
	bind:open={deleteOpen}
	title="Delete this workout?"
	description="Its sets leave history, hints and records for good, on every device."
	confirmLabel="Delete"
	onconfirm={() => void remove()}
/>
