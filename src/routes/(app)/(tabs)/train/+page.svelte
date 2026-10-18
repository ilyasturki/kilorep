<script lang="ts">
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';

	import { exerciseCatalog } from '$lib/exercises/catalog.svelte';
	import { lastDoneByTemplate, nextUp } from '$lib/domain/rotation';
	import { drawableMark, startable, startFrom } from '$lib/domain/template';
	import { cursors, firstUncompleted } from '$lib/domain/workout';
	import { elapsedLabel, trainedWhen } from '$lib/history/label';
	import { openedFrom } from '$lib/nav/bar.svelte';
	import { restamp } from '$lib/nav/stack.svelte';
	import { restSettings } from '$lib/settings/rest.svelte';
	import { planLine, planMeta, rotationLine, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';
	import ClockCounterClockwise from '$lib/ui/icons/ClockCounterClockwise.svelte';
	import Play from '$lib/ui/icons/Play.svelte';
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
		const workout = startFrom(template, Date.now(), () => crypto.randomUUID(), {
			planDefault: data.planRests[template.id],
			settings: restSettings.current
		});
		const first = firstUncompleted(workout);

		activeWorkout.begin(
			data.history,
			{ workout, activeSetId: first === null ? null : first.set.id },
			data.grips
		);

		await goto('/train/live');
	}

	const running = $derived(activeWorkout.session);

	const runningPlan = $derived(
		running === null ? undefined : data.templates.find((t) => t.id === running.workout.templateId)
	);

	const runningSets = $derived(running === null ? [] : cursors(running.workout));

	let now = $state(Date.now());

	$effect(() => {
		const clock = setInterval(() => (now = Date.now()), 30_000);

		return () => clearInterval(clock);
	});

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
	const blank = openedFrom(`/plan/templates/${crypto.randomUUID()}`, '/train');

	function trained(template: Template) {
		return trainedWhen(lastDone[template.id] ?? null, now);
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
		restamp();

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

<svelte:document onvisibilitychange={() => (now = Date.now())} />

{#snippet doors()}
	<div class="list-group">
		{#if next !== null}
			{#snippet cards()}
				<span class="grid size-8 place-items-center"><Cards size={20} /></span>
			{/snippet}

			<ListRow
				title="All templates"
				href={openedFrom('/plan/templates', '/train')}
				leading={cards}
			/>
		{/if}

		{#snippet clock()}
			<span class="grid size-8 place-items-center"><ClockCounterClockwise size={20} /></span>
		{/snippet}

		<ListRow title="History" href={openedFrom('/history', '/train')} leading={clock} />
	</div>
{/snippet}

{#snippet hero(label: string, aside: string, plan: Template | undefined, lines: string[])}
	<div class="flex flex-col gap-2">
		<p class="flex min-w-0 items-baseline gap-2">
			<span class="shrink-0 label-caps text-accent-text">{label}</span>
			<span class="line-clamp-2 text-base font-bold text-ink-muted">{aside}</span>
		</p>

		<div class="flex items-start gap-3">
			<TemplateMark mark={plan === undefined ? null : drawableMark(plan)} />

			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="truncate text-xl font-extrabold tracking-tight text-ink">
					{plan === undefined ? 'Workout' : templateTitle(plan)}
				</span>
				{#each lines as line, at (at)}
					<span
						class={[
							'truncate font-bold',
							at === 0 ? 'text-md text-ink-muted' : 'text-sm text-ink-faint'
						]}
					>
						{line}
					</span>
				{/each}
			</div>
		</div>
	</div>
{/snippet}

<main class="min-h-0 flex-1 overflow-y-auto">
	{#if running === null && next === null}
		<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
			<EmptyState
				title="No plans yet"
				description="Build one in Plan and the rotation puts it here, under your thumb."
			>
				{#snippet icon()}
					<Stack size={24} />
				{/snippet}
				{#snippet action()}
					<div class="mx-auto flex w-full max-w-xs flex-col gap-2">
						<Button variant="commit" compact href={blank}>
							<Plus size={20} />
							New plan
						</Button>
						<Button variant="secondary" compact onclick={() => void startEmpty()}>
							Start an empty workout
						</Button>
					</div>
				{/snippet}
			</EmptyState>

			{@render doors()}
		</div>
	{:else}
		<div
			class="column-board flex min-h-full flex-col gap-5 px-3 pt-3 lg:flex-row-reverse
				lg:items-start lg:gap-6 lg:pb-4"
		>
			<div class="flex min-w-0 flex-col gap-5 lg:flex-1">
				{#if running === null && next !== null}
					<section class="flex flex-col gap-2">
						<h2 class="px-3 label-caps">Start another</h2>

						<div class="list-group">
							{#each rest as template (template.id)}
								{#snippet tile()}
									<TemplateMark mark={drawableMark(template)} />
								{/snippet}

								<ListRow
									title={templateTitle(template)}
									meta={planLine(template, exerciseCatalog.current.byId)}
									stacked
									chevron={false}
									leading={tile}
									onclick={() => void startTemplate(template)}
								>
									{#snippet trailing()}
										{trained(template).short}
									{/snippet}
								</ListRow>
							{/each}

							{#snippet well()}
								<span class="size-8 rounded-lg border-[1.5px] border-dashed border-line"></span>
							{/snippet}

							<ListRow
								title="Empty workout"
								meta="Add exercises as you go"
								stacked
								chevron={false}
								leading={well}
								onclick={() => void startEmpty()}
							/>
						</div>
					</section>
				{/if}

				{@render doors()}
			</div>

			<section
				class="sticky bottom-0 -mx-3 mt-auto bg-canvas px-3 pt-1 pb-4 lg:static lg:mx-0
					lg:mt-0 lg:flex-1 lg:p-0"
			>
				<div class="flex flex-col gap-4 card-raised p-3">
					{#if running !== null}
						{@render hero(
							'In progress',
							elapsedLabel(running.workout.startedAt, now),
							runningPlan,
							[
								`${runningSets.filter((c) => c.set.completed).length} of ${runningSets.length} sets logged`
							]
						)}

						<Button variant="commit" caps class="w-full" href="/train/live">
							<Play size={24} />
							RESUME
						</Button>
					{:else if next !== null}
						{@render hero('Next up', rotationLine(next), next.plan, [
							planLine(next.plan, exerciseCatalog.current.byId),
							`${planMeta(next.plan)} · ${trained(next.plan).long}`
						])}

						<Button
							variant="commit"
							caps
							class="w-full"
							onclick={() => void startTemplate(next.plan)}
						>
							<Play size={24} />
							START
						</Button>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</main>
