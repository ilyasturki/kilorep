<script lang="ts">
	import { goto } from '$app/navigation';

	import { catalog } from '$lib/catalog';
	import { fillAppBar } from '$lib/nav/bar.svelte';
	import type { Exercise } from '$lib/domain/exercise';
	import { bodyweightShareOf, carriedFrom, carriedOn } from '$lib/domain/load';
	import { restLabel } from '$lib/domain/rest';
	import { bestEstimate, rawPr } from '$lib/domain/stats';
	import { addExercise, PLANNED_SET_COUNT } from '$lib/domain/template';
	import type { Template } from '$lib/domain/template';
	import { historyKey, settleGrip } from '$lib/domain/grip';
	import { kin } from '$lib/exercises/browse';
	import EstimatedMax from '$lib/exercises/EstimatedMax.svelte';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import {
		lastSetLabel,
		lastSinceLabel,
		loadLabel,
		loadModeNote,
		ordinal
	} from '$lib/exercises/label';
	import { restSettings } from '$lib/settings/rest.svelte';
	import RestDurationField from '$lib/settings/RestDurationField.svelte';
	import { getStore } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import { templateTitle } from '$lib/templates/plan';
	import PlanPickerSheet from '$lib/templates/PlanPickerSheet.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { press } from '$lib/ui/press';
	import Pencil from '$lib/ui/icons/Pencil.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';
	import { persistSession } from '$lib/workout/persist.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exercise = $derived(data.exercise);

	fillAppBar(() => ({ title: exercise.name }));

	const family = $derived(kin(catalog, exercise));

	// The whole screen answers for one grip at a time. A raw best that mixed the rope's numbers
	// into the bar's would be a record nobody set, and a history list that interleaved them would
	// read as one lift getting stronger and weaker by turns.
	const axis = $derived(exercise.grips);

	let chip = $state<string | null>(null);

	const grip = $derived(settleGrip(exercise, chip));

	const past = $derived(data.gripped[historyKey(exercise.id, exercise, grip)] ?? []);

	const sessions = $derived(past.toReversed());

	const carried = $derived(carriedFrom(data.bodyweight, () => exercise));

	const on = $derived(carriedOn(carried, exercise.id));

	const pr = $derived(rawPr(past, on));

	// A lift the body is part of cannot call its record the heaviest: the heaviest day on a
	// pull-up is the day the scale read highest, which is the one thing the record is now
	// careful not to rank. Where the belt was empty the reps are what won, and the tile names
	// them — `Best set` was the first try and it answers to the `Best` badge in the history
	// below, which is the other statistic entirely.
	const carries = $derived(bodyweightShareOf(exercise) > 0);

	const repRecord = $derived(carries && pr !== null && pr.set.weight === 0);

	const HEAVIEST_NOTE =
		'The heaviest you have ever moved on this grip, body weight included. What you lifted, ' +
		'not a formula.';

	const REPS_NOTE =
		'The most reps you have ever held on this grip with nothing on the belt. The kilos are ' +
		'your body on the day, stated but never ranked — a heavier morning is not a record. Put ' +
		'something on the belt and that leads again.';

	// The heaviest day and the strongest day are two questions, and the same list answers both.
	const best = $derived(bestEstimate(past, on));

	const loadNote = $derived(loadModeNote(exercise.loadMode));

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	// Uneven widths: a row of identical blocks reads as a page still loading.
	const GHOST_SETS = ['w-18', 'w-16', 'w-16'];

	const now = Date.now();

	// Tri-state: `undefined` = no override, the Settings default applies;
	// `null` = never rest on this exercise; a number = its own duration.
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

	const live = $derived(activeWorkout.session);

	let planOpen = $state(false);
	let planned = $state<Template | null>(null);

	async function addToWorkout() {
		const session = activeWorkout.session;

		if (session === null) {
			return;
		}

		const store = await getStore();

		// The workout screen's autosave effect is not mounted, so the write is this page's.
		session.addExercises([exercise.id]);
		persistSession(store, session);

		await goto('/train/live');
	}

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

	// svelte-ignore state_referenced_locally
	const initial = data.note;

	let draft = $state(initial);

	let writing = $state(initial !== '');

	let saved = initial;

	// Long enough that a typed word is one record, short enough to beat a back gesture.
	const SETTLE_MS = 600;

	// `saved` moves before the first `await`: the settle timer and the unmount
	// flush race on every navigation, and the loser must see its write claimed.
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

	$effect(() => {
		const text = draft;

		if (text.trim() === saved) {
			return;
		}

		const timer = setTimeout(() => void commit(text), SETTLE_MS);

		return () => clearTimeout(timer);
	});

	$effect(() => () => {
		void commit(draft);
	});

	// A plain variable so the `caret` attachment tracks nothing: a reactive read
	// would re-run it on every keystroke and steal the caret to the end.
	let claiming = false;

	function open() {
		claiming = true;
		writing = true;
	}

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

{#snippet familyRow(entry: Exercise)}
	{@const last = data.lastPerformed[entry.id]}
	{@const since = lastSinceLabel(last, now)}

	{#snippet recency()}{since}{/snippet}

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
		href="/plan/exercises/{entry.id}"
	/>
{/snippet}

<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-3 pb-4">
	<header class="flex flex-col gap-2">
		<div class="flex items-center justify-between gap-4 px-1">
			<div class="flex min-w-0 flex-col gap-2">
				<h1 class="hidden text-xl font-extrabold tracking-tight text-ink lg:block">
					{exercise.name}
				</h1>

				{#if loadNote}
					<p class="text-md font-bold text-ink-faint">{loadNote}</p>
				{/if}

				<div class="flex flex-wrap gap-1.5">
					<Badge tone="accent">{exercise.muscles.primary}</Badge>
					{#each exercise.muscles.secondary as muscle (muscle)}
						<Badge>{muscle}</Badge>
					{/each}
				</div>
			</div>

			<ExerciseIllustration id={exercise.id} name={exercise.name} class="size-36 shrink-0" />
		</div>

		{#if axis !== undefined}
			<!-- Everything below answers for the chip that is on: the best, and the sessions. A
			     grip nothing has been logged on yet still gets a chip — an empty history is an
			     answer, and hiding it would say the gym has no bar. -->
			<div class="flex flex-col gap-2 px-1">
				<span class="label-caps">{axis.label}</span>

				<ChipGroup
					layout="row"
					label={axis.label}
					bind:value={
						() => grip ?? '',
						(next) => {
							if (typeof next === 'string' && next !== '') {
								chip = next;
							}
						}
					}
				>
					{#each axis.values as value (value.id)}
						<Chip value={value.id}>{value.label}</Chip>
					{/each}
				</ChipGroup>
			</div>
		{/if}

		{#if pr !== null}
			<div class="flex w-fit flex-wrap items-baseline gap-x-2 rounded-xl bg-surface px-3 py-2">
				<Tooltip text={repRecord ? REPS_NOTE : HEAVIEST_NOTE}>
					<span class="label-caps">{repRecord ? 'Most reps' : 'Heaviest ever'}</span>
				</Tooltip>
				<span class="text-md font-extrabold tracking-tight">
					{loadLabel(pr.load)} × {pr.set.reps}
				</span>

				<!-- `0 added` is a number saying nothing twice: on a bar it is the load again, and on a
				     pull-up it is the whole of what was lifted named as an absence. A load that is the
				     added weight again is also how a missing weigh-in shows: before the first one the body
				     reads as zero, and the line would either repeat the belt or say the lifter weighs
				     nothing. -->
				{#if carries && pr.load !== pr.set.weight}
					<span class="text-sm font-bold text-ink-faint">
						{pr.set.weight === 0 ? 'body weight' : `${pr.set.weight} added`}
					</span>
				{/if}
			</div>
		{/if}
	</header>

	<EstimatedMax {exercise} {past} carried={on} {now} />

	{#if restSettings.current.enabled}
		<section class="flex flex-col gap-3">
			<h2 class="px-3 label-caps">Rest</h2>

			<div class="flex flex-col gap-3 px-3">
				<Switch
					label="Rest on this exercise"
					description={rests
						? 'A countdown starts when a working set is logged'
						: 'No countdown. This one is never timed'}
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

	<section class="flex flex-col px-3">
		{#if writing}
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

				{#if live !== null}
					<Button variant="secondary" class="w-full" onclick={() => void addToWorkout()}>
						Add to this workout
					</Button>
				{:else if planned !== null}
					<Button variant="secondary" class="w-full" href="/plan/templates/{planned.id}">
						Added to {templateTitle(planned)}
					</Button>
				{:else if data.plans.length > 0}
					<Button variant="secondary" class="w-full" onclick={() => (planOpen = true)}>
						Add to a plan
					</Button>
				{/if}
			</div>

			<PlanPickerSheet
				bind:open={planOpen}
				title="Add to a plan"
				templates={data.plans}
				onpick={(template) => void addToPlan(template)}
			/>
		{:else}
			<div class="list-group">
				{#each sessions as session (session.workoutId)}
					<!-- Both marks are the winning set found in this row rather than a date matched
					     against it: two sessions can share a day, and only one of them set it. -->
					{@const heaviest = pr !== null && session.sets.includes(pr.set)}
					{@const strongest = best !== null && session.sets.includes(best.set)}

					<a
						href="/history/{session.workoutId}"
						data-list-row
						class={[
							'flex press-sink flex-col gap-2 border-l-2 px-3 py-2.5 focus-ring',
							'hover:bg-hover pointer-fine:transition-[background-color]',
							'pointer-fine:duration-100 press:bg-surface-2',
							// Side-scoped: `border-accent` would repaint the hairline `list-group` rules
							// the rows above and below draw with, and the mark would leak into them.
							heaviest
								? 'border-l-accent'
								: strongest
									? 'border-l-ink-faint'
									: 'border-l-transparent'
						]}
						{@attach press()}
					>
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-ink-faint">
								{day.format(session.date)} · {ordinal(session.position)} exercise
							</span>
							{#if heaviest}
								<Badge tone="accent">PR</Badge>
							{/if}
							{#if strongest}
								<Badge>Best</Badge>
							{/if}
							<span aria-hidden="true" class="ml-auto text-xl leading-none text-ink-faint">
								›
							</span>
						</div>

						<div class="flex flex-wrap gap-1.5">
							{#each session.sets as set, index (index)}
								<!-- The badge names the day and the chip names the set that earned it: on a
								     day whose heaviest single is not its best estimate, the two land apart. -->
								{@const claimed = set === pr?.set ? 'pr' : set === best?.set ? 'best' : null}

								<!-- The heavier claim is filled and the other is ringed. `surface-2` was the
								     first try and it inverts by theme: lighter than `sunken` on a white card,
								     which drew the marked chip as the quiet one. -->
								<span
									class={[
										'inline-flex items-baseline gap-1 rounded-lg bg-sunken px-2.5 py-1.5',
										claimed === 'pr' && 'bg-accent-soft text-accent-text',
										claimed === 'best' && 'ring-2 ring-ink-faint ring-inset'
									]}
								>
									<span class="text-md font-extrabold tracking-tight">{set.weight}</span>
									<span
										class={[
											'text-sm font-bold',
											claimed === 'pr'
												? 'text-accent-text'
												: claimed === 'best'
													? 'text-ink-muted'
													: 'text-ink-faint'
										]}
									>
										×{set.reps}
									</span>
								</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</main>
