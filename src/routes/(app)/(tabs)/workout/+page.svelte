<script lang="ts">
	import { invalidate } from '$app/navigation';

	import { catalogById } from '$lib/catalog';
	import { lastDoneByTemplate, nextUp } from '$lib/domain/rotation';
	import { drawableMark, startable, startFrom } from '$lib/domain/template';
	import { firstUncompleted } from '$lib/domain/workout';
	import { formatSince, lastDoneLine } from '$lib/history/label';
	import { planLine, planMeta, templateTitle } from '$lib/templates/plan';
	import TemplateMark from '$lib/templates/TemplateMark.svelte';
	import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Plus from '$lib/ui/icons/Plus.svelte';

	import type { Template } from '$lib/domain/template';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// No goto after the invalidation: this address redirects itself the moment the holder says a
	// session runs, and replaces its own entry doing it. A goto to where we already are would
	// push a duplicate, and back out of the session would land on the session.
	async function startEmpty() {
		activeWorkout.begin(data.history, null, data.grips);

		await invalidate(SESSION_DEP);
	}

	async function startTemplate(template: Template) {
		const workout = startFrom(template, Date.now(), () => crypto.randomUUID());
		const first = firstUncompleted(workout);

		activeWorkout.begin(
			data.history,
			{ workout, activeSetId: first === null ? null : first.set.id },
			data.grips
		);

		await invalidate(SESSION_DEP);
	}

	const now = Date.now();

	const plans = $derived(startable(data.templates));

	const lastDone = $derived(lastDoneByTemplate(data.workouts));

	const next = $derived(nextUp(plans, lastDone));

	// Four, because All templates is a row away and a screen that lists everything twice is the
	// screen this replaced. List order rather than rotation order: this half answers "not that
	// one, this one", and the answer is easiest to find where the lifter dragged it.
	const REST = 4;

	const rest = $derived(plans.filter((plan) => plan.id !== next?.id).slice(0, REST));

	function doneAt(template: Template): number | null {
		return lastDone[template.id] ?? null;
	}
</script>

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Next up</h2>

			<div class="flex flex-col gap-4 rounded-2xl border border-line-soft bg-surface p-3">
				{#if next === null}
					<div class="flex flex-col gap-0.5 px-1">
						<span class="text-xl font-extrabold tracking-tight text-ink">Empty workout</span>
						<span class="text-md font-bold text-ink-muted">Add exercises as you go.</span>
					</div>
				{:else}
					{@const mark = drawableMark(next)}

					<div class="flex items-start gap-3 px-1">
						{#if mark !== null}
							<TemplateMark {mark} />
						{/if}

						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-xl font-extrabold tracking-tight text-ink">
								{templateTitle(next)}
							</span>
							<span class="truncate text-md font-bold text-ink-muted">
								{planLine(next, catalogById)}
							</span>
							<span class="truncate text-sm font-bold text-ink-faint">
								{planMeta(next)} · {lastDoneLine(doneAt(next), now)}
							</span>
						</div>
					</div>
				{/if}

				<Button
					variant="commit"
					caps
					class="w-full"
					onclick={() => void (next === null ? startEmpty() : startTemplate(next))}
				>
					START
				</Button>
			</div>
		</section>

		{#if next !== null}
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
			<ListRow title="All templates" href="/templates" />
			<ListRow title="History" href="/history" />
		</div>
	</div>
</main>
