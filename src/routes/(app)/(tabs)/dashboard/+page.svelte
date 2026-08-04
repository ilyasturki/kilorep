<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import Sparkline from '$lib/dashboard/Sparkline.svelte';
	import WorkoutBanner from '$lib/dashboard/WorkoutBanner.svelte';
	import { rollingAverage, localDateOf, weeklyRate, windowed } from '$lib/domain/bodyweight';
	import { consistency, estTrend, mainLifts, muscleVolume, recentPrs } from '$lib/domain/dashboard';
	import { loadFactor } from '$lib/domain/exercise';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
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
	 * is a plain section. The banner above all four is the way into a workout,
	 * and its own file states why home is entitled to one.
	 *
	 * ## Two columns, and why they are uneven
	 *
	 * `column-board` rather than the `column-content` every other tab takes: that
	 * cap steps *down* to 36rem at `lg` to leave gutter for the Workout rail, and
	 * a screen with no rail paid the price for nothing — four answers stacked in
	 * a 576px ribbon made a desk window scroll to reach a figure a phone could
	 * already see. `app.css` carries the arithmetic.
	 *
	 * The split is by column and not by row, because the cards are wildly uneven:
	 * Progressing? is a list and runs ~400px, while the other three are one
	 * figure each and run 120–190. Paired off in a 2×2 they would have stretched
	 * to their tallest — Consistent? carrying ~280px of empty card — so
	 * Progressing? takes the left column alone and the other three stack right,
	 * which measures level. Below `lg` the two columns are simply two blocks in
	 * one flex column, and the reading order is unchanged from when it was four:
	 * Progressing, Consistent, Balanced, Weight.
	 *
	 * ## Compactness
	 *
	 * The screen answers at a glance or it has failed, and it was failing on a
	 * phone: `recentPrs` is uncapped, so a good month put eight 62px rows above
	 * everything else and the first card *was* the first screen. Three bests
	 * show, the rest are one tap away in place, and the rows are the 44px
	 * `dense` ones — a screen read rather than tapped through, which is the
	 * whole of that token's rule. Balanced? draws only what was trained and
	 * names the rest in a line, so eleven rows collapse to five without losing
	 * the neglect that is the card's entire point.
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

	/**
	 * How many bests stand before the fold. Three, because the card has a second
	 * list under it and the screen has three more cards under that — the cap is
	 * about what a phone can answer with, not about what is worth knowing, which
	 * is why the rest stay one tap away rather than being dropped.
	 *
	 * Held here and not in `recentPrs`: the derivation's job is every best in the
	 * window, and a screen that can reveal the remainder needs all of them.
	 */
	const PR_ROWS = 3;

	let expanded = $state(false);
	const panelId = $props.id();

	const hidden = $derived(Math.max(0, prs.length - PR_ROWS));

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

	/**
	 * Drawn and named: the muscles with volume get a bar, the muscles without get
	 * a line naming them.
	 *
	 * `muscleVolume` still answers with all eleven — a neglected muscle at zero
	 * *is* the answer this card exists for, and that reasoning is intact. What
	 * changed is that eleven bar rows, seven of them empty, cost the card 200px
	 * to say something a sentence says in one line. The zeros are still stated,
	 * still by name, and still without the user having to ask.
	 */
	const trained = $derived(volume.filter((row) => row.kg > 0));
	const untrained = $derived(volume.filter((row) => row.kg === 0).map((row) => row.muscle));

	const kgFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
	const listFormat = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

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

<main class="column-board flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up, same bargain as Weight: the bar above already says
	     Dashboard in the lit tab — and carries the gear beside its mark, which is
	     why this one goes with the header rather than staying on screen.

	     One compact row rather than the other tabs' 28px title under 24px of
	     padding. Those screens open on a list and can spend 80px introducing
	     themselves; this one opens on the answer to "what now" and three more
	     below it, and the lit tab has already said the word "Dashboard" once. The
	     heading stays — a screen owes a reader an h1 — it just stops being the
	     largest thing on a phone screen it has no business leading.

	     The gear is here because this is home. It hung off the idle Workout
	     screen while that tab led the bar, and stayed there when home moved,
	     which left the app's one door to Settings on a screen the app no longer
	     opens at — and behind a redirect, since `/workout` hands off to the loop
	     the moment a session exists. Two taps from any tab now, and none at all
	     from a live session on a phone: the account, the server and the tokens
	     are the definition of not-mid-workout, so that is a price and not a hole.
	     The desk bar keeps its own gear through a session, a 1080px window not
	     being the floor rule 7 protects. -->
	<header class="flex items-center justify-between gap-3 px-1 pt-2 lg:hidden">
		<h1 class="text-lg font-extrabold tracking-tight">Dashboard</h1>

		<a
			href="/settings"
			aria-label="Settings"
			class="grid min-h-chrome w-11 place-items-center rounded-full border border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			<Gear size={20} />
		</a>
	</header>

	<!-- Above the questions and outside the `bare` branch both: a first install
	     has nothing to answer *and* nothing to answer it with, and the way to fix
	     that is the one thing this screen should still offer. -->
	<WorkoutBanner />

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
		<!-- `items-start` is what keeps the grid honest: without it the two columns
		     stretch to the taller, and the left one is a bordered card that would
		     grow a foot of empty surface below its last row. -->
		<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
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

							{#each prs.slice(0, PR_ROWS) as pr (pr.exerciseId)}
								<ListRow
									title={nameOf(pr.exerciseId)}
									meta={day.format(pr.date)}
									href="/exercises/{pr.exerciseId}"
									chevron={false}
									dense
								>
									{#snippet trailing()}
										<span class="tabular-nums">{pr.set.weight} × {pr.set.reps}</span>
									{/snippet}
								</ListRow>
							{/each}

							<!-- In place rather than through a door: there is no screen that
							     lists recent bests, and inventing one to hold four rows would
							     be a screen that fails PRODUCT.md's own test. The state is
							     local and deliberately unremembered — a card that answers
							     "how am I going" should open the same way every time. -->
							{#if hidden > 0}
								<button
									type="button"
									aria-expanded={expanded}
									aria-controls={panelId}
									onclick={() => (expanded = !expanded)}
									class="flex min-h-chrome items-center gap-2 self-start rounded-xl px-3
										text-sm font-bold text-ink-faint focus-ring
										hover:bg-hover active:bg-surface-2"
								>
									<CaretDown size={14} class={expanded ? 'rotate-180' : ''} />
									{expanded ? 'Show fewer' : `${hidden} more ${hidden === 1 ? 'best' : 'bests'}`}
								</button>

								{#if expanded}
									<div id={panelId} class="flex flex-col gap-1">
										{#each prs.slice(PR_ROWS) as pr (pr.exerciseId)}
											<ListRow
												title={nameOf(pr.exerciseId)}
												meta={day.format(pr.date)}
												href="/exercises/{pr.exerciseId}"
												chevron={false}
												dense
											>
												{#snippet trailing()}
													<span class="tabular-nums">{pr.set.weight} × {pr.set.reps}</span>
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
							<h3 class="px-1 text-sm font-bold text-ink-faint">
								Main lifts · est 1RM, kg · 12 weeks
							</h3>

							{#each liftRows as row (row.exerciseId)}
								<ListRow
									title={nameOf(row.exerciseId)}
									href="/exercises/{row.exerciseId}"
									chevron={false}
									dense
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

			<div class="flex flex-col gap-4">
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
									<span class="w-2 rounded-full bg-ink-faint" style:height="{barHeight(count)}%"
									></span>
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
							{#each trained as row (row.muscle)}
								<div class="flex items-center gap-3">
									<span class="w-24 shrink-0 text-sm font-bold text-ink-muted">{row.muscle}</span>
									<span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
										<span
											class="block h-full rounded-full bg-ink"
											style:width="{(row.kg / volumeMax) * 100}%"
										></span>
									</span>
									<span
										class="w-14 shrink-0 text-right text-sm font-bold text-ink-muted tabular-nums"
									>
										{kgFormat.format(row.kg)}
									</span>
								</div>
							{/each}

							<!-- The zeros, by name. Eleven empty bars said this at ten times the
							     height, and a card that has to be scrolled to reveal a neglected
							     muscle is not answering the question it asks. -->
							{#if untrained.length > 0}
								<p class="text-sm font-bold text-ink-faint">
									Nothing on {listFormat.format(untrained)}.
								</p>
							{/if}
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
			</div>
		</div>
	{/if}
</main>
