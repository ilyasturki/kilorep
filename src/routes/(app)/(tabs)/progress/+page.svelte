<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { rollingAverage, localDateOf, weeklyRate, windowed } from '$lib/domain/bodyweight';
	import { loadFactor } from '$lib/domain/exercise';
	import { carriedFrom, carriedOn } from '$lib/domain/load';
	import {
		estTrend,
		mainLifts,
		muscleSets,
		recentPrs,
		rollingConsistency,
		weeklyWork
	} from '$lib/domain/progress';
	import { loadLabel } from '$lib/exercises/label';
	import Sparkline from '$lib/progress/Sparkline.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import ChartBar from '$lib/ui/icons/ChartBar.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const now = Date.now();
	const today = localDateOf(new Date());

	const DAY = 86_400_000;
	const since4 = now - 28 * DAY;
	const since12 = now - 84 * DAY;

	const CARD = 'flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3';
	const DOOR = `${CARD} focus-ring pointer-fine:transition-colors pointer-fine:hover:bg-hover`;

	const HEADLINE = 'text-2xl font-extrabold tracking-numeral tabular-nums text-accent-text';

	// Every use spells the gap before the unit as `&nbsp;`: a unit must not wrap off its
	// number, and Svelte trims a leading space at an element boundary (`50.6t` otherwise).
	const UNIT = 'text-md font-extrabold tracking-normal';
	const SUB = 'text-md font-bold text-ink-faint';
	const WINDOW = 'text-sm font-bold text-ink-faint';

	const nameOf = (exerciseId: string): string => catalogById[exerciseId]?.name ?? exerciseId;
	const factorOf = (exerciseId: string): number =>
		loadFactor(catalogById[exerciseId]?.loadMode ?? 'total');

	const carried = $derived(carriedFrom(data.bodyweight, (id) => catalogById[id]));

	const kgFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
	const listFormat = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });
	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	const work = $derived(weeklyWork(data.workouts, now, factorOf, carried));
	const workMax = $derived(Math.max(...work.map((week) => week.kg)));
	const lastWeek = $derived(work.at(-1) ?? { start: now, kg: 0, sets: 0 });

	const tonnage = $derived.by(() => {
		const kg = lastWeek.kg;

		return kg >= 1000
			? { value: (Math.round(kg / 100) / 10).toFixed(1), unit: 't' }
			: { value: kgFormat.format(kg), unit: 'kg' };
	});

	const workHeight = (kg: number): number => (workMax === 0 ? 0 : (kg / workMax) * 100);

	const prs = $derived(recentPrs(data.sessions, since4, carried));

	const PR_ROWS = 3;

	let expanded = $state(false);
	const panelId = $props.id();

	const hidden = $derived(Math.max(0, prs.length - PR_ROWS));

	const lifts = $derived(mainLifts(data.sessions, since12, factorOf, carried));

	const liftRows = $derived(
		lifts
			.map((exerciseId) => {
				const trend = estTrend(
					data.sessions[exerciseId] ?? [],
					since12,
					carriedOn(carried, exerciseId)
				);
				const first = trend.at(0);
				const last = trend.at(-1);

				return {
					exerciseId,
					points: trend.map((point) => ({ x: point.date, y: point.est })),
					est: last === undefined ? null : Math.round(last.est),
					delta: first === undefined || last === undefined ? 0 : last.est - first.est
				};
			})
			.filter((row) => row.est !== null)
	);

	function deltaLabel(delta: number): string {
		const rounded = Math.round(delta * 2) / 2;

		if (rounded > 0) {
			return `+${rounded}`;
		}

		return rounded < 0 ? `−${Math.abs(rounded)}` : 'level';
	}

	const habit = $derived(
		rollingConsistency(
			data.workouts.map((workout) => workout.startedAt),
			now
		)
	);

	const habitLabel = $derived.by(() => {
		if (habit.median === null) {
			return null;
		}

		return Number.isInteger(habit.median)
			? `${habit.median}`
			: `${Math.floor(habit.median)}–${Math.ceil(habit.median)}`;
	});

	const barMax = $derived(Math.max(...habit.weeks, habit.last7, 1));

	const barHeight = (count: number): number =>
		count === 0 ? 10 : Math.max(10, (count / barMax) * 100);

	const muscles = $derived(muscleSets(data.workouts, since4, (id) => catalogById[id]));

	const muscleMax = $derived(Math.max(...muscles.map((row) => row.direct + row.indirect)));

	const trained = $derived(muscles.filter((row) => row.direct + row.indirect > 0));
	const untrained = $derived(
		muscles.filter((row) => row.direct + row.indirect === 0).map((row) => row.muscle)
	);

	const totalSets = $derived(muscles.reduce((sum, row) => sum + row.direct, 0));

	const weightLine = $derived(windowed(rollingAverage(data.bodyweight), today, 28));
	const weightNow = $derived(weightLine.at(-1) ?? null);
	const rate = $derived(weeklyRate(weightLine));

	const rateLabel = $derived.by(() => {
		if (rate === null) {
			return null;
		}

		const rounded = Math.round(Math.abs(rate) * 10) / 10;

		if (rounded === 0) {
			return 'Holding steady over 4 weeks';
		}

		return `${rate > 0 ? '+' : '−'}${rounded} kg a week over 4 weeks`;
	});

	const bare = $derived(data.workouts.length === 0 && data.bodyweight.length === 0);
</script>

<svelte:head>
	<title>Progress | Kilorep</title>
</svelte:head>

<main class="column-board flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	{#if bare}
		<EmptyState
			title="Nothing to show yet"
			description="Finish a session or log a weigh-in and this screen fills itself in."
		>
			{#snippet icon()}
				<ChartBar size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<section class={CARD}>
			<div class="flex items-baseline justify-between px-1">
				<h2 class="label-caps">Weekly work</h2>
				<span class={WINDOW}>12 weeks</span>
			</div>

			{#if workMax === 0}
				<p class="px-1 pb-1 {SUB}">Nothing logged in the last twelve weeks.</p>
			{:else}
				<div class="flex flex-col gap-1 px-1">
					<span class={HEADLINE}>
						{tonnage.value}<span class={UNIT}>&nbsp;{tonnage.unit}</span>
					</span>
					<span class={SUB}>
						{lastWeek.sets}
						{lastWeek.sets === 1 ? 'set' : 'sets'} in the last 7 days
					</span>
				</div>

				<div class="flex flex-col gap-1 px-1 pb-1">
					<div
						aria-hidden="true"
						class="flex h-17 items-end gap-[2px] border-b border-line-soft lg:h-32"
					>
						{#each work as week, i (week.start)}
							<span
								class={[
									'min-h-[3px] flex-1 rounded-t-[4px]',
									i === work.length - 1 ? 'bg-ink' : 'bg-ink-faint'
								]}
								style:height="{workHeight(week.kg)}%"
							></span>
						{/each}
					</div>

					<div class="flex justify-between text-xs font-bold text-ink-faint tabular-nums">
						<span>{day.format(work[0].start)}</span>
						<span>Last 7 days</span>
					</div>
				</div>
			{/if}
		</section>

		<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
			<section class={CARD}>
				<h2 class="px-1 label-caps">Strength</h2>

				{#if prs.length === 0 && liftRows.length === 0}
					<p class="px-1 pb-1 {SUB}">No trend yet. A few weeks of sessions draw one.</p>
				{:else}
					{#if prs.length > 0}
						<div class="flex flex-col gap-1">
							<h3 class="px-1 {WINDOW}">Last 4 weeks</h3>

							{#each prs.slice(0, PR_ROWS) as pr (pr.exerciseId)}
								<ListRow
									title={nameOf(pr.exerciseId)}
									href="/exercises/{pr.exerciseId}"
									chevron={false}
									dense
								>
									{#snippet badge()}
										<Badge tone="accent">PR</Badge>
									{/snippet}
									{#snippet trailing()}
										<span class={WINDOW}>{day.format(pr.date)}</span>
										<span class="tabular-nums">{loadLabel(pr.load)} × {pr.set.reps}</span>
									{/snippet}
								</ListRow>
							{/each}

							{#if hidden > 0}
								<button
									type="button"
									aria-expanded={expanded}
									aria-controls={panelId}
									onclick={() => (expanded = !expanded)}
									class="mt-1 flex min-h-chrome w-full items-center justify-center gap-2
										rounded-b-xl border-t border-line-soft text-sm font-bold text-ink-faint
										focus-ring hover:bg-hover press:bg-surface-2"
									{@attach press()}
								>
									<CaretDown size={14} class={expanded ? 'rotate-180' : ''} />
									{expanded ? 'Show fewer' : `${hidden} more ${hidden === 1 ? 'best' : 'bests'}`}
								</button>

								{#if expanded}
									<div id={panelId} class="flex flex-col gap-1">
										{#each prs.slice(PR_ROWS) as pr (pr.exerciseId)}
											<ListRow
												title={nameOf(pr.exerciseId)}
												href="/exercises/{pr.exerciseId}"
												chevron={false}
												dense
											>
												{#snippet badge()}
													<Badge tone="accent">PR</Badge>
												{/snippet}
												{#snippet trailing()}
													<span class={WINDOW}>{day.format(pr.date)}</span>
													<span class="tabular-nums">{loadLabel(pr.load)} × {pr.set.reps}</span>
												{/snippet}
											</ListRow>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}

					{#if liftRows.length > 0}
						<div class="flex flex-col gap-1">
							<div class="flex items-baseline justify-between px-1">
								<h3 class={WINDOW}>Estimated 1RM</h3>
								<span class={WINDOW}>12 weeks</span>
							</div>

							{#each liftRows as row (row.exerciseId)}
								<ListRow
									title={nameOf(row.exerciseId)}
									href="/exercises/{row.exerciseId}"
									chevron={false}
									dense
								>
									{#snippet trailing()}
										<Sparkline points={row.points} />
										<span class="tabular-nums">{row.est}</span>
										<span class="w-12 text-right {WINDOW} tabular-nums">
											{deltaLabel(row.delta)}
										</span>
									{/snippet}
								</ListRow>
							{/each}
						</div>
					{/if}
				{/if}
			</section>

			<div class="flex flex-col gap-4">
				<a href="/history" class={DOOR}>
					<span class="flex items-center justify-between px-1">
						<h2 class="label-caps">Training frequency</h2>
						<span aria-hidden="true" class="text-xl leading-none text-ink-faint">›</span>
					</span>

					<span class="flex items-end justify-between gap-4 px-1 pb-1">
						<span class="flex flex-col gap-1">
							<span class={HEADLINE}>
								{habit.last7}<span class={UNIT}
									>&nbsp;{habit.last7 === 1 ? 'session' : 'sessions'}</span
								>
							</span>

							<span class={SUB}>
								{#if habitLabel === null}
									Last 7 days, your usual shows after a full week
								{:else}
									Last 7 days, usually {habitLabel} a week
								{/if}
							</span>
						</span>

						{#if habit.weeks.length > 0}
							<span aria-hidden="true" class="flex h-9 shrink-0 items-end gap-1">
								{#each habit.weeks as count, i (i)}
									<span class="w-2 rounded-full bg-ink-faint" style:height="{barHeight(count)}%"
									></span>
								{/each}
								<span class="w-2 rounded-full bg-ink" style:height="{barHeight(habit.last7)}%"
								></span>
							</span>
						{/if}
					</span>
				</a>

				<section class={CARD}>
					<div class="flex items-baseline justify-between px-1">
						<h2 class="label-caps">Sets per muscle</h2>
						<span class={WINDOW}>4 weeks</span>
					</div>

					{#if muscleMax === 0}
						<p class="px-1 pb-1 {SUB}">Nothing logged in the last four weeks.</p>
					{:else}
						<div class="flex flex-col gap-1 px-1">
							<span class={HEADLINE}>
								{totalSets}<span class={UNIT}>&nbsp;working {totalSets === 1 ? 'set' : 'sets'}</span
								>
							</span>
						</div>

						<div class="flex flex-col gap-2 px-1">
							{#each trained as row (row.muscle)}
								<div class="flex items-center gap-3">
									<span class="w-24 shrink-0 text-sm font-bold text-ink-muted">{row.muscle}</span>

									<span class="flex h-2 flex-1 gap-[2px]">
										{#if row.direct > 0}
											<span
												class="block h-full rounded-full bg-ink"
												style:width="{(row.direct / muscleMax) * 100}%"
											></span>
										{/if}
										{#if row.indirect > 0}
											<span
												class="block h-full rounded-full bg-ink-faint/45"
												style:width="{(row.indirect / muscleMax) * 100}%"
											></span>
										{/if}
									</span>

									<span
										class="w-10 shrink-0 text-right text-sm font-bold text-ink-muted tabular-nums"
									>
										{row.direct + row.indirect}
									</span>
								</div>
							{/each}
						</div>

						<div class="flex flex-col gap-2 px-1 pb-1">
							<div class="flex items-center gap-4 text-xs font-bold text-ink-faint">
								<span class="flex items-center gap-1.5">
									<span aria-hidden="true" class="size-2 rounded-full bg-ink"></span>Direct
								</span>
								<span class="flex items-center gap-1.5">
									<span aria-hidden="true" class="size-2 rounded-full bg-ink-faint/45"
									></span>Indirect
								</span>
							</div>

							{#if untrained.length > 0}
								<p class="text-sm font-bold text-ink-faint">
									Nothing on {listFormat.format(untrained)}.
								</p>
							{/if}
						</div>
					{/if}
				</section>

				<a href="/weight" class={DOOR}>
					<span class="flex items-center justify-between px-1">
						<h2 class="label-caps">Body weight</h2>
						<span aria-hidden="true" class="text-xl leading-none text-ink-faint">›</span>
					</span>

					{#if weightNow === null}
						<span class="px-1 pb-1 {SUB}">
							No weigh-ins yet. The trend starts on the Weight screen.
						</span>
					{:else}
						<span class="flex items-end justify-between gap-4 px-1 pb-1">
							<span class="flex flex-col gap-1">
								<span class={HEADLINE}>
									{Math.round(weightNow.kg * 10) / 10}<span class={UNIT}>&nbsp;kg</span>
								</span>

								<span class={SUB}>{rateLabel ?? 'Keep logging, a rate needs two weeks'}</span>
							</span>

							<Sparkline
								points={weightLine.map((entry) => ({ x: Date.parse(entry.date), y: entry.kg }))}
								width={120}
								height={36}
							/>
						</span>
					{/if}
				</a>
			</div>
		</div>
	{/if}
</main>
