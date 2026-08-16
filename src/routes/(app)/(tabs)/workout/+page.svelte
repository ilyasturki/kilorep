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

	let { data }: PageProps = $props();

	async function startEmpty() {
		activeWorkout.begin(data.history);

		await invalidate(SESSION_DEP);
		await goto('/workout/live');
	}

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

	async function repeat(workout: Workout) {
		await launchRepeat(data.store, workout);
	}

	const startable = $derived(data.templates.filter((template) => !isArchived(template)));

	const idleTemplates = $derived(startable.slice(0, 4));

	const recent = $derived(data.workouts.toReversed().slice(0, 4));

	const now = Date.now();

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

		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Workout | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
		{#if startable.length === 0 && recent.length === 0}
			<p class="px-3 text-md font-bold text-ink-faint">Start empty and build as you go.</p>
		{/if}

		{#if startable.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">Start from a template</h2>

				<div class="list-group">
					{#each idleTemplates as template (template.id)}
						{@const mark = drawableMark(template)}

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
						/>
					{/each}
				</div>

				{#if startable.length > idleTemplates.length}
					<ListRow title="See all templates" href="/templates" />
				{/if}
			</section>
		{/if}

		{#if recent.length > 0}
			<section class="flex flex-col gap-2">
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
							{#snippet trailing()}
								<span class="lg:hidden">{when.short}</span>
								<span class="hidden lg:inline">{when.long}</span>
							{/snippet}
						</ListRow>
					{/each}
				</div>

				<ListRow title="See all workouts" href="/history" />
			</section>
		{/if}

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
