<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import Sparkline from '$lib/dashboard/Sparkline.svelte';
	import { rollingAverage, localDateOf, weeklyRate, windowed } from '$lib/domain/bodyweight';
	import { consistency, estTrend, mainLifts, muscleVolume, recentPrs } from '$lib/domain/dashboard';
	import { loadFactor } from '$lib/domain/exercise';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import ChartBar from '$lib/ui/icons/ChartBar.svelte';
	import Gear from '$lib/ui/icons/Gear.svelte';

	import type { PageProps } from './$types';

	/**
	 * The Dashboard: PRODUCT.md's four standing questions, one card each, no
	 * configuration. It is the landing screen now — it leads the bar, and `/`
	 * in the APK, `AFTER_LOGIN` and the top bar's mark were pointed here with
	 * it; `navTabs` is where that was decided and why. Every answer is derived
	 * in `$lib/domain/dashboard` from what the load already read; nothing here
	 * writes, so there is no store and no sync to hold.
	 *
	 * The windows are the derivation's defaults, stated in each card's own
	 * small print: four weeks back for bests, balance and the weight rate,
	 * twelve for the main lifts, eight full weeks for the habit. Tuned here if
	 * the phone ever disagrees — never by the user; a dashboard with knobs is a
	 * screen that asks questions instead of answering them.
	 *
	 * Two cards are doors: Consistent? opens History and Weight on track?
	 * opens the Weight screen, whose bar slot this screen took — the whole
	 * card is the link, which is why neither may hold a link of its own.
	 * Progressing?'s rows go to their exercise details instead, so that card
	 * is a plain section.
	 */
	let { data }: PageProps = $props();

	// Captured once per mount, the idiom every read-only screen here uses: a
	// window edge that drifts under an open screen buys nothing but jitter.
	const now = Date.now();
	const today = localDateOf(new Date());

	const DAY = 86_400_000;
	const since4 = now - 28 * DAY;
	const since12 = now - 84 * DAY;

	const nameOf = (exerciseId: string): string => catalogById[exerciseId]?.name ?? exerciseId;

	// --- Progressing? -------------------------------------------------------

	const prs = $derived(recentPrs(data.sessions, since4));

	const lifts = $derived(
		mainLifts(data.sessions, since12, (exerciseId) =>
			loadFactor(catalogById[exerciseId]?.loadMode ?? 'total')
		)
	);

	const liftRows = $derived(
		lifts
			.map((exerciseId) => {
				const trend = estTrend(data.sessions[exerciseId] ?? [], since12);
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

	/** Signed, to the half kilo — the grain the est deserves as a signal. */
	function deltaLabel(delta: number): string {
		const rounded = Math.round(delta * 2) / 2;

		if (rounded > 0) {
			return `+${rounded}`;
		}

		return rounded < 0 ? `−${Math.abs(rounded)}` : 'level';
	}

	// --- Consistent? --------------------------------------------------------

	const habit = $derived(
		consistency(
			data.workouts.map((workout) => workout.startedAt),
			new Date(now)
		)
	);

	const habitLabel = $derived.by(() => {
		if (habit.habit === null) {
			return null;
		}

		return Number.isInteger(habit.habit)
			? `${habit.habit}`
			: `${Math.floor(habit.habit)}–${Math.ceil(habit.habit)}`;
	});

	const barMax = $derived(Math.max(...habit.weeks, habit.thisWeek, 1));

	/** Zero keeps a visible stub — an empty week is a fact, not a gap in the chart. */
	const barHeight = (count: number): number =>
		count === 0 ? 10 : Math.max(10, (count / barMax) * 100);

	// --- Balanced? ----------------------------------------------------------

	const volume = $derived(
		muscleVolume(data.workouts, since4, (exerciseId) => catalogById[exerciseId])
	);
	const volumeMax = $derived(Math.max(...volume.map((row) => row.kg)));

	const kgFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

	// --- Weight on track? ---------------------------------------------------

	// Averaged over the whole log first, then windowed — the first visible
	// points rest on the days just before the window, same as the Weight
	// screen's chart.
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

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	const bare = $derived(data.workouts.length === 0 && data.bodyweight.length === 0);
</script>

<svelte:head>
	<title>Dashboard | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up, same bargain as Weight: the bar above already says
	     Dashboard in the lit tab — and carries the gear beside its mark, which is
	     why this one goes with the header rather than staying on screen.

	     The gear is here because this is home. It hung off the idle Workout
	     screen while that tab led the bar, and stayed there when home moved,
	     which left the app's one door to Settings on a screen the app no longer
	     opens at — and behind a redirect, since `/workout` hands off to the loop
	     the moment a session exists. Two taps from any tab now, and none at all
	     from a live session on a phone: the account, the server and the tokens
	     are the definition of not-mid-workout, so that is a price and not a hole.
	     The desk bar keeps its own gear through a session, a 1080px window not
	     being the floor rule 7 protects. -->
	<header class="flex items-start justify-between gap-3 px-1 pt-6 lg:hidden">
		<h1 class="text-2xl font-extrabold tracking-tight">Dashboard</h1>

		<a
			href="/settings"
			aria-label="Settings"
			class="grid min-h-chrome w-11 place-items-center rounded-full border border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			<Gear size={20} />
		</a>
	</header>

	{#if bare}
		<EmptyState
			title="Nothing to ask yet"
			description="The four questions here answer themselves once workouts and weigh-ins exist to read."
		>
			{#snippet icon()}
				<ChartBar size={24} />
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Progressing? — internal links, so the card is a section, not a door. -->
		<section class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3">
			<h2 class="px-1 label-caps">Progressing?</h2>

			{#if prs.length === 0 && liftRows.length === 0}
				<p class="px-1 pb-1 text-md font-bold text-ink-faint">
					No trend yet — a few weeks of sessions draw one.
				</p>
			{:else}
				{#if prs.length > 0}
					<div class="flex flex-col gap-1">
						<h3 class="px-1 text-sm font-bold text-ink-faint">New bests · last 4 weeks</h3>

						{#each prs as pr (pr.exerciseId)}
							<ListRow
								title={nameOf(pr.exerciseId)}
								meta={day.format(pr.date)}
								href="/exercises/{pr.exerciseId}"
								chevron={false}
							>
								{#snippet trailing()}
									<span class="tabular-nums">{pr.set.weight} × {pr.set.reps}</span>
								{/snippet}
							</ListRow>
						{/each}
					</div>
				{/if}

				{#if liftRows.length > 0}
					<div class="flex flex-col gap-1">
						<h3 class="px-1 text-sm font-bold text-ink-faint">
							Main lifts · est 1RM, kg · 12 weeks
						</h3>

						{#each liftRows as row (row.exerciseId)}
							<ListRow
								title={nameOf(row.exerciseId)}
								href="/exercises/{row.exerciseId}"
								chevron={false}
							>
								{#snippet trailing()}
									<Sparkline points={row.points} />
									<span class="tabular-nums">{row.est} · {deltaLabel(row.delta)}</span>
								{/snippet}
							</ListRow>
						{/each}
					</div>
				{/if}
			{/if}
		</section>

		<!-- Consistent? — the whole card opens History; facts, never streaks. -->
		<a
			href="/history"
			class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3 focus-ring
				pointer-fine:transition-colors pointer-fine:hover:bg-hover"
		>
			<span class="flex items-center justify-between px-1">
				<h2 class="label-caps">Consistent?</h2>
				<span aria-hidden="true" class="text-xl leading-none text-ink-faint">›</span>
			</span>

			<span class="flex items-end justify-between gap-4 px-1 pb-1">
				<span class="flex flex-col gap-1">
					<span class="text-2xl font-extrabold tracking-tight tabular-nums">
						{habit.thisWeek}
						{habit.thisWeek === 1 ? 'session' : 'sessions'} this week
					</span>

					<span class="text-md font-bold text-ink-faint">
						{#if habitLabel === null}
							Your habit shows after the first full week
						{:else}
							Usually {habitLabel} a week
						{/if}
					</span>
				</span>

				{#if habit.weeks.length > 0}
					<!-- The trailing full weeks in faint, the running week in ink. -->
					<span aria-hidden="true" class="flex h-9 shrink-0 items-end gap-1">
						{#each habit.weeks as count, i (i)}
							<span class="w-2 rounded-full bg-ink-faint" style:height="{barHeight(count)}%"></span>
						{/each}
						<span class="w-2 rounded-full bg-ink" style:height="{barHeight(habit.thisWeek)}%"
						></span>
					</span>
				{/if}
			</span>
		</a>

		<!-- Balanced? — no door: the answer is the whole card. -->
		<section class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3">
			<div class="flex items-baseline justify-between px-1">
				<h2 class="label-caps">Balanced?</h2>
				<span class="text-sm font-bold text-ink-faint">volume kg · 4 weeks</span>
			</div>

			{#if volumeMax === 0}
				<p class="px-1 pb-1 text-md font-bold text-ink-faint">
					Nothing logged in the last four weeks.
				</p>
			{:else}
				<div class="flex flex-col gap-2 px-1 pb-1">
					{#each volume as row (row.muscle)}
						<div class="flex items-center gap-3">
							<span class="w-24 shrink-0 text-sm font-bold text-ink-muted">{row.muscle}</span>
							<span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
								<span
									class="block h-full rounded-full bg-ink"
									style:width="{(row.kg / volumeMax) * 100}%"
								></span>
							</span>
							<span class="w-14 shrink-0 text-right text-sm font-bold text-ink-muted tabular-nums">
								{kgFormat.format(row.kg)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Weight on track? — goal-free by decision: the card states the trend's
		     direction and rate, and the door leads to the screen that logs it. -->
		<a
			href="/weight"
			class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3 focus-ring
				pointer-fine:transition-colors pointer-fine:hover:bg-hover"
		>
			<span class="flex items-center justify-between px-1">
				<h2 class="label-caps">Weight on track?</h2>
				<span aria-hidden="true" class="text-xl leading-none text-ink-faint">›</span>
			</span>

			{#if weightNow === null}
				<span class="px-1 pb-1 text-md font-bold text-ink-faint">
					No weigh-ins yet — the trend starts on the Weight screen.
				</span>
			{:else}
				<span class="flex items-end justify-between gap-4 px-1 pb-1">
					<span class="flex flex-col gap-1">
						<span class="text-2xl font-extrabold tracking-tight tabular-nums">
							{Math.round(weightNow.kg * 10) / 10} kg
						</span>

						<span class="text-md font-bold text-ink-faint">
							{rateLabel ?? 'Keep logging — a rate needs two weeks'}
						</span>
					</span>

					<Sparkline
						points={weightLine.map((entry) => ({ x: Date.parse(entry.date), y: entry.kg }))}
						width={120}
						height={36}
					/>
				</span>
			{/if}
		</a>
	{/if}
</main>
