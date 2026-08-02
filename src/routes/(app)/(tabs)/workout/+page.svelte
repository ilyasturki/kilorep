<script lang="ts">
	import { goto, invalidate } from '$app/navigation';

	import { startFrom } from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { appBarSlot } from '$lib/nav/bar.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Barbell from '$lib/ui/icons/Barbell.svelte';
	import Gear from '$lib/ui/icons/Gear.svelte';

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
	 * screen's whole job, and the tab keeps the editor route for reading.
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

	// The bar's right-hand slot, given back on the way out. Home is where
	// PRODUCT.md pins "gear to Settings", and this screen is home. The loop fills
	// the same slot with FINISH; neither screen has to know about the other's,
	// which is one more thing the split took out of a branch.
	const bar = appBarSlot();

	$effect(() => {
		bar.action = gear;

		return () => {
			bar.action = null;
		};
	});
</script>

{#snippet gear()}
	<a
		href="/settings"
		aria-label="Settings"
		class="grid min-h-chrome w-11 place-items-center rounded-full border border-line
			text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
	>
		<Gear size={20} />
	</a>
{/snippet}

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<!-- The templates ride under the start button as the ways a workout begins
     rather than as a route to walk — reading and editing them stays the tab's
     job, and past the glance-sized few the last row is the walk there. -->
<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
		<header class="flex items-start justify-between gap-3 pt-10 lg:hidden">
			<h1 class="text-2xl font-extrabold tracking-tight">Kilorep</h1>

			{@render gear()}
		</header>

		<EmptyState
			class="pb-16"
			title="No workout running"
			description={data.templates.length === 0
				? 'Start empty and build as you go.'
				: 'Start empty and build as you go, or begin from a template.'}
		>
			{#snippet icon()}
				<Barbell size={24} />
			{/snippet}
			{#snippet action()}
				<div class="flex w-full flex-col items-center gap-3">
					<Button variant="commit" onclick={() => void startEmpty()}>Start empty workout</Button>

					{#if idleTemplates.length > 0}
						<!-- `text-left` undoes the EmptyState's centring: these are the
						     same rows the Templates tab stacks, and a row is not a
						     caption. A tap starts — see `startTemplate` for why this
						     list is exempt from the tab's open-don't-start rule. -->
						<div class="w-full max-w-sm list-group text-left">
							{#each idleTemplates as template (template.id)}
								<ListRow
									title={template.name.trim() === '' ? 'Untitled' : template.name}
									meta={planned(template)}
									chevron={false}
									onclick={() => void startTemplate(template)}
								/>
							{/each}

							{#if data.templates.length > idleTemplates.length}
								<ListRow title="See all templates" href="/templates" />
							{/if}
						</div>
					{/if}
				</div>
			{/snippet}
		</EmptyState>
	</div>
</main>
