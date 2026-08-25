<script lang="ts">
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';

	import { catalogById } from '$lib/catalog';
	import { lastDoneByTemplate, nextUp } from '$lib/domain/rotation';
	import { drawableMark, startable, startFrom } from '$lib/domain/template';
	import { cursors, firstUncompleted } from '$lib/domain/workout';
	import { formatSince, lastDoneLine } from '$lib/history/label';
	import { planLine, planMeta, rotationLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	import type { Template } from '$lib/domain/template';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Starting is the one act that enters the session: this screen no longer redirects itself
	// while one runs, so the push here is what puts `/train/live` in front — and behind it,
	// this home for back to land on.
	async function startEmpty() {
		activeWorkout.begin(data.history, null, data.grips);

		await goto('/train/live');
	}

	async function startTemplate(template: Template) {
		const workout = startFrom(template, Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(workout);

		activeWorkout.begin(
			data.history,
			{ workout, activeSetId: first === null ? null : first.set.id },
			data.grips
		);

		await goto('/train/live');
	}

	const running = $derived(activeWorkout.session);

	const runningTitle = $derived.by(() => {
		if (running === null) {
			return '';
		}

		const template = data.templates.find((t) => t.id === running.workout.templateId);

		return template === undefined ? 'Workout' : templateTitle(template);
	});

	const runningSets = $derived(running === null ? [] : cursors(running.workout));

	const now = Date.now();

	const plans = $derived(startable(data.templates));

	const lastDone = $derived(lastDoneByTemplate(data.workouts));

	const next = $derived(nextUp(plans, lastDone));

	// Four, because All templates is a row away and a screen that lists everything twice is the
	// screen this replaced. List order rather than rotation order: this half answers "not that
	// one, this one", and the answer is easiest to find where the lifter dragged it.
	const REST = 4;

	const rest = $derived(plans.filter((plan) => plan.id !== next?.plan.id).slice(0, REST));

	// The same address Templates offers its own empty state, so the way out of "no plans" is one
	// tap from either screen rather than a list on the way to the editor.
	const blank = `/plan/templates/${crypto.randomUUID()}`;

	function doneAt(template: Template): number | null {
		return lastDone[template.id] ?? null;
	}

	// The launcher's Train shortcut, arriving as a request to press the START below rather
	// than as its own way of starting one — the plan it picks, the empty fallback and the
	// snapshot it takes are this screen's, unduplicated.
	//
	// Struck from the URL before anything is written, and struck whether or not it starts
	// anything: this is the one entry the lifter never looked at first, and an address
	// carrying a live instruction would start a second session on the next reload.
	//
	// A session already running is never discarded for a shortcut — the request collapses
	// into resuming it.
	//
	// `afterNavigate`, not `$effect`: on a cold load the effect fires before the router is
	// up, and `replaceState` throws there. This callback runs once the navigation — the
	// initial one included — has settled, which is the earliest a `goto` is worth anything.
	afterNavigate(() => {
		if (page.url.searchParams.get('start') !== 'next') {
			return;
		}

		const settled = new URL(page.url);

		settled.searchParams.delete('start');
		replaceState(settled, page.state);

		if (running !== null) {
			void goto('/train/live');

			return;
		}

		void (next === null ? startEmpty() : startTemplate(next.plan));
	});
</script>

<svelte:head>
	<title>Train | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
		{#if running !== null}
			<!-- One card and no START buttons: a second workout on top of a running one is not a
			     thing this screen may offer, and the way back into the session should be the
			     biggest thing on it. -->
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">In progress</h2>

				<div class="flex flex-col gap-4 rounded-2xl bg-surface p-3">
					<div class="flex min-w-0 flex-col gap-0.5 px-1">
						<span class="truncate text-xl font-extrabold tracking-tight text-ink">
							{runningTitle}
						</span>
						<span class="truncate text-md font-bold text-ink-muted">
							{runningSets.filter((c) => c.set.completed).length} of {runningSets.length} sets logged
						</span>
					</div>

					<Button variant="commit" caps class="w-full" href="/train/live">RESUME</Button>
				</div>
			</section>
		{:else if next === null}
			<!-- No plan is next, because there is no rotation to be next in. The card that used to
			     stand here said "Next up: Empty workout", which is not a rotation reporting a
			     position but a screen keeping its shape after its subject left. -->
			<EmptyState
				title="No plans yet"
				description="Build one in Plan and the rotation puts it here, under your thumb."
			>
				{#snippet icon()}
					<Stack size={24} />
				{/snippet}
				{#snippet action()}
					<div class="mx-auto flex w-full max-w-xs flex-col gap-2">
						<Button variant="commit" compact href={blank}>New plan</Button>
						<Button variant="secondary" compact onclick={() => void startEmpty()}>
							Start an empty workout
						</Button>
					</div>
				{/snippet}
			</EmptyState>
		{:else}
			{@const nextMark = drawableMark(next.plan)}

			<section class="flex flex-col gap-2">
				<!-- The rotation's arithmetic rides up here rather than in the card: the card is
				     already three lines about the plan, and a fourth about why it was picked would
				     compete with them for a width a phone does not have. Clamped rather than
				     truncated, because a long plan name loses its whole tail to one line and the
				     name is the half of this that says anything; two lines is where it stops
				     pushing the card down the screen. -->
				<h2 class="line-clamp-2 px-3 label-caps">Next up · {rotationLine(next)}</h2>

				<div class="flex flex-col gap-4 rounded-2xl bg-surface p-3">
					<div class="flex items-start gap-3 px-1">
						{#if nextMark !== null}
							<TemplateMark mark={nextMark} />
						{/if}

						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-xl font-extrabold tracking-tight text-ink">
								{templateTitle(next.plan)}
							</span>
							<span class="truncate text-md font-bold text-ink-muted">
								{planLine(next.plan, catalogById)}
							</span>
							<span class="truncate text-sm font-bold text-ink-faint">
								{planMeta(next.plan)} · {lastDoneLine(doneAt(next.plan), now)}
							</span>
						</div>
					</div>

					<Button
						variant="commit"
						caps
						class="w-full"
						onclick={() => void startTemplate(next.plan)}
					>
						START
					</Button>
				</div>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">Or start</h2>

				<div class="list-group">
					{#each rest as template (template.id)}
						{@const mark = drawableMark(template)}
						{@const since = doneAt(template)}

						{#snippet tile()}
							{#if mark !== null}
								<TemplateMark {mark} />
							{/if}
						{/snippet}

						<ListRow
							title={templateTitle(template)}
							meta={planLine(template, catalogById)}
							stacked
							chevron={false}
							leading={mark === null ? undefined : tile}
							onclick={() => void startTemplate(template)}
						>
							{#snippet trailing()}
								{since === null ? 'New' : formatSince(since, now)}
							{/snippet}
						</ListRow>
					{/each}

					{#snippet plus()}
						<Plus size={20} />
					{/snippet}

					<ListRow
						title="Empty workout"
						weight="bold"
						chevron={false}
						leading={plus}
						onclick={() => void startEmpty()}
					/>
				</div>
			</section>
		{/if}

		<div class="list-group">
			<!-- All templates is dropped while the rotation is empty: the empty state above is
			     already this screen's door to Plan, and a row leading to a list of nothing is the
			     second glance saying what the first one said. -->
			{#if next !== null}
				{#snippet cards()}
					<Cards size={20} />
				{/snippet}

				<ListRow title="All templates" href="/plan/templates" leading={cards} />
			{/if}

			{#snippet clock()}
				<ClockCounterClockwise size={20} />
			{/snippet}

			<ListRow title="History" href="/history" leading={clock} />
		</div>
	</div>
</main>
