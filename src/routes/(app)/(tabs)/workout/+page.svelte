<script lang="ts">
	import { goto, invalidate } from '$app/navigation';

	import { startFrom } from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';

	import type { Template } from '$lib/domain/template';
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
	 * of the other. This one is a start button and a glance of templates; the
	 * loop is the loop. Nothing in either is behind a branch on which one you
	 * meant.
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

	/** The idle list stays a glance, not a page: the tab holds the rest. */
	const idleTemplates = $derived(data.templates.slice(0, 4));

	// The Templates tab's own wording, so the same plan reads the same on both.
	function planned(template: Template): string {
		const count = template.entries.flatMap((entry) => entry.exercises).length;

		if (count === 0) {
			return 'No exercises yet';
		}

		return count === 1 ? '1 exercise' : `${count} exercises`;
	}
</script>

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
		{#if data.templates.length === 0}
			<!-- The whole of what this screen has to say before there is a plan to
			     name: one line, no icon, no second button. The act is at the foot
			     where it always is, and a graphic over an empty pane would be
			     decoration on the one screen that opens every session. -->
			<p class="px-3 text-md font-bold text-ink-faint">Start empty and build as you go.</p>
		{:else}
			<section class="flex flex-col gap-2">
				<!-- The heading is what makes a tap on a row unambiguous. On the
				     Templates tab the same row opens a plan, and PRODUCT.md is
				     deliberate that one row cannot honestly carry both meanings —
				     here it carries one, and this says which. -->
				<h2 class="px-3 label-caps">Start from a template</h2>

				<div class="list-group">
					{#each idleTemplates as template (template.id)}
						<ListRow
							title={template.name.trim() === '' ? 'Untitled' : template.name}
							meta={planned(template)}
							chevron={false}
							onclick={() => void startTemplate(template)}
						/>
					{/each}
				</div>

				<!-- Outside the card on purpose, the arrangement the Templates tab
				     already uses: inside it this would be a fifth row that looked
				     like a plan and started nothing. -->
				{#if data.templates.length > idleTemplates.length}
					<ListRow title="See all templates" href="/templates" />
				{/if}
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
