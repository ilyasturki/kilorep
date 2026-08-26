<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { matchRange, searchExercises } from '$lib/domain/search';
	import type { Exercise, Muscle } from '$lib/domain/exercise';
	import { countOf, sections } from '$lib/exercises/browse';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import { lastSetLabel, lastSinceLabel } from '$lib/exercises/label';
	import type { LastPerformed } from '$lib/store/derive';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import MagnifyingGlass from '$lib/ui/icons/MagnifyingGlass.svelte';
	import { revealStart } from '$lib/ui/scroll';

	type Props = {
		query: string;
		lastPerformed: LastPerformed;
	};

	let { query, lastPerformed }: Props = $props();

	const now = Date.now();

	const browse = sections(catalog);

	const searching = $derived(query.trim() !== '');

	const results = $derived(searchExercises(catalog, query));

	let active = $state<Muscle>(browse[0].muscle);

	// A tap owns the highlight until its scroll settles — without this the spy would flick
	// through every muscle the jump passes.
	let jumping = $state(false);

	let settle: ReturnType<typeof setTimeout> | undefined;

	const targets = new Map<Muscle, HTMLElement>();
	const pills = new Map<Muscle, HTMLElement>();

	let rail = $state<HTMLElement | null>(null);

	function spy() {
		if (jumping) {
			return;
		}

		const floor = (rail?.getBoundingClientRect().bottom ?? 0) + 8;

		let current = browse[0].muscle;

		for (const section of browse) {
			const target = targets.get(section.muscle);

			if (target !== undefined && target.getBoundingClientRect().top <= floor) {
				current = section.muscle;
			}
		}

		if (current !== active) {
			active = current;
			pills.get(current)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}

	function jump(muscle: Muscle) {
		const target = targets.get(muscle);

		if (target === undefined) {
			return;
		}

		active = muscle;
		jumping = true;

		clearTimeout(settle);
		settle = globalThis.setTimeout(() => (jumping = false), 900);

		// The section's `scroll-mt-14` is the rail's height plus the same 8px breath `spy` uses.
		revealStart(target);
	}

	// The list scrolls inside the tab layout's pane, not the window — a capture-phase listener
	// hears it without this component having to know which ancestor scrolls.
	$effect(() => {
		if (searching) {
			return;
		}

		globalThis.addEventListener('scroll', spy, { capture: true, passive: true });

		return () => {
			globalThis.removeEventListener('scroll', spy, { capture: true });
			clearTimeout(settle);
		};
	});
</script>

{#snippet variantBadge()}
	<span class="rounded-full bg-surface-2 px-2 py-0.5 label-caps text-ink-muted">Variant</span>
{/snippet}

{#snippet row(exercise: Exercise, variant = false)}
	{@const last = lastPerformed[exercise.id]}
	{@const since = lastSinceLabel(last, now)}
	{@const set = lastSetLabel(exercise, last)}

	{#snippet recency()}{since}{/snippet}

	{#snippet thumb()}
		<span class="size-11 shrink-0">
			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-full" />
		</span>
	{/snippet}

	{#snippet elbow()}
		<span
			aria-hidden="true"
			class="mb-2.5 ml-1 size-3 shrink-0 rounded-bl-md border-b-2 border-l-2 border-line-soft"
		></span>
	{/snippet}

	<ListRow
		title={exercise.name}
		match={searching ? matchRange(exercise.name, query) : null}
		description={set === undefined ? exercise.equipment : `${exercise.equipment} · ${set}`}
		weight={variant ? 'bold' : 'extrabold'}
		badge={searching && exercise.variantOf !== undefined ? variantBadge : undefined}
		leading={variant ? elbow : thumb}
		trailing={since === undefined ? undefined : recency}
		dense={variant}
		href="/plan/exercises/{exercise.id}"
		class={variant ? 'pl-4' : undefined}
	/>
{/snippet}

{#if searching}
	{#if results.length === 0}
		<EmptyState title="Nothing found" description="No exercise answers to that.">
			{#snippet icon()}
				<MagnifyingGlass size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<div class="list-group">
			{#each results as exercise (exercise.id)}
				{@render row(exercise)}
			{/each}
		</div>
	{/if}
{:else}
	<nav
		bind:this={rail}
		aria-label="Jump to muscle"
		class="sticky top-0 z-10 -mx-3 flex [scrollbar-width:none] gap-0.5 overflow-x-auto bg-canvas px-3
			py-2 [&::-webkit-scrollbar]:hidden"
	>
		{#each browse as section (section.muscle)}
			{@const on = section.muscle === active}

			<button
				type="button"
				aria-current={on ? 'true' : undefined}
				onclick={() => jump(section.muscle)}
				class={[
					'flex h-8 flex-none items-center rounded-full px-3 text-md focus-ring select-none',
					on ? 'bg-nav-selected font-extrabold text-ink' : 'font-semibold text-ink-faint'
				]}
				{@attach (node) => {
					pills.set(section.muscle, node);

					return () => pills.delete(section.muscle);
				}}
			>
				{section.muscle}
			</button>
		{/each}
	</nav>

	<div class="flex flex-col gap-5">
		{#each browse as section (section.muscle)}
			<section
				class="flex scroll-mt-14 flex-col gap-2"
				{@attach (node) => {
					targets.set(section.muscle, node);

					return () => targets.delete(section.muscle);
				}}
			>
				<h2 class="px-3 label-caps">{section.muscle} · {countOf(section.families)}</h2>

				<div class="list-group">
					{#each section.families as family (family.parent.id)}
						{@render row(family.parent)}

						{#each family.variants as variant (variant.id)}
							{@render row(variant, true)}
						{/each}
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
