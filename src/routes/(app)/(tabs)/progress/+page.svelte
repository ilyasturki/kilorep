<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { rollingAverage, localDateOf, weeklyRate, windowed } from '$lib/domain/bodyweight';
	import { loadFactor } from '$lib/domain/exercise';
	import {
		estTrend,
		mainLifts,
		muscleSets,
		recentPrs,
		rollingConsistency,
		weeklyWork
	} from '$lib/domain/progress';
	import Sparkline from '$lib/progress/Sparkline.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import ChartBar from '$lib/ui/icons/ChartBar.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	/**
	 * Progress: five statements about your own training, one card each, no
	 * configuration. Every figure is derived in `$lib/domain/progress` from what
	 * the load already read; nothing here writes, so there is no store and no
	 * sync to hold.
	 *
	 * The gate is in PRODUCT.md and it is not the old one: a card earns its place
	 * by stating something about your training you cannot work out in your head,
	 * and by pointing at where that thing is logged. The four standing questions
	 * this screen used to ask were a narrower rule and they cost the titles —
	 * "Balanced?" is a question the card then has to answer twice, once in the
	 * heading and once in the bars. Headings state, they no longer ask.
	 *
	 * ## Two windows, and no third
	 *
	 * Four weeks for bests, muscle balance and the weight rate; twelve for the
	 * est-1RM trend and the work chart. Frequency is the last seven days against
	 * the seven-day windows behind it. Each card states its own in its top right,
	 * and none of them is tunable — a screen with knobs is one that asks a
	 * question instead of answering it.
	 *
	 * Every window rolls back from now, and that is the correction this rework
	 * exists for. "This week" used to mean since Monday, drawn beside a median of
	 * eight *complete* weeks, so a Tuesday morning read as a collapse and a Sunday
	 * night as a peak. Nothing on the screen is anchored to a weekday now.
	 *
	 * ## The accent
	 *
	 * One figure per card wears `accent-text`, plus the PR pill on a best. That is
	 * the whole budget. Bars, sparklines and labels stay in ink, because a chart
	 * painted in the accent would be claiming the accent means "a number" — and in
	 * this app it means one thing, which `app.css` states.
	 *
	 * ## Two columns, and why they are uneven
	 *
	 * `column-board` rather than the `column-content` every other tab takes: that
	 * cap steps *down* to 36rem at `lg` to leave gutter for the Workout rail, and
	 * a screen with no rail paid the price for nothing. `app.css` carries the
	 * arithmetic.
	 *
	 * Weekly work takes the full width above the split — it is the one card that
	 * is mostly chart, and twelve bars in half a desk window are a picket fence.
	 * Below it the split is by column and not by row, because the cards are
	 * wildly uneven: Strength is two lists and runs ~450px, Sets per muscle is
	 * eleven rows and runs ~390, and the other two are one figure each at ~110.
	 * Paired off in a 2×2 the short ones would stretch to their tallest and carry
	 * a foot of empty card, so Strength takes the left column alone and the other
	 * three stack right. The two columns do not measure exactly level and are not
	 * meant to — `items-start` is what lets the shorter one simply stop. Below
	 * `lg` it is one flex column and the reading order is unchanged: Work,
	 * Strength, Frequency, Muscle, Weight.
	 *
	 * ## Compactness
	 *
	 * The screen answers at a glance or it has failed. `recentPrs` is uncapped, so
	 * a good month would put eight rows above everything else: three show, the
	 * rest are one tap away in place, and the rows are the 44px `dense` ones — a
	 * screen read rather than tapped through. Sets per muscle draws only what was
	 * trained and names the rest in a line, so eleven rows collapse to five or six
	 * without losing the neglect that is the card's entire point.
	 */
	let { data }: PageProps = $props();

	// Captured once per mount, the idiom every read-only screen here uses: a
	// window edge that drifts under an open screen buys nothing but jitter.
	const now = Date.now();
	const today = localDateOf(new Date());

	const DAY = 86_400_000;
	const since4 = now - 28 * DAY;
	const since12 = now - 84 * DAY;

	// The card and the card-that-is-a-door. Written as constants because there
	// are five of them now and a recipe copied five times drifts in four.
	const CARD = 'flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3';
	const DOOR = `${CARD} focus-ring pointer-fine:transition-colors pointer-fine:hover:bg-hover`;

	const HEADLINE = 'text-2xl font-extrabold tracking-numeral tabular-nums text-accent-text';

	/**
	 * The unit trailing a headline figure, at the body size and back on normal
	 * tracking — `tracking-numeral` is cut for digits and pulls a word tight.
	 * Every use spells the gap as `&nbsp;`, which is both correct (a unit never
	 * wraps off its number) and necessary: Svelte trims a leading space at an
	 * element boundary, and the figures rendered as `50.6t` without it.
	 */
	const UNIT = 'text-md font-extrabold tracking-normal';
	const SUB = 'text-md font-bold text-ink-faint';
	const WINDOW = 'text-sm font-bold text-ink-faint';

	const nameOf = (exerciseId: string): string => catalogById[exerciseId]?.name ?? exerciseId;
	const factorOf = (exerciseId: string): number =>
		loadFactor(catalogById[exerciseId]?.loadMode ?? 'total');

	const kgFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
	const listFormat = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });
	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

	// --- Weekly work --------------------------------------------------------

	const work = $derived(weeklyWork(data.workouts, now, factorOf));
	const workMax = $derived(Math.max(...work.map((week) => week.kg)));
	// `weeklyWork` always answers with its full count of buckets, so this is the
	// last seven days. The fallback settles a type, never a state.
	const lastWeek = $derived(work.at(-1) ?? { start: now, kg: 0, sets: 0 });

	/**
	 * Kilos below a tonne and tonnes above it. A working week is five figures in
	 * kg and unreadable at a glance; a first week is three and reads as "0.4 t",
	 * which is worse. The unit follows the number rather than the number being
	 * bent to a unit.
	 */
	const tonnage = $derived.by(() => {
		const kg = lastWeek.kg;

		return kg >= 1000
			? { value: (Math.round(kg / 100) / 10).toFixed(1), unit: 't' }
			: { value: kgFormat.format(kg), unit: 'kg' };
	});

	/** Zero keeps a visible stub — an empty week is a fact, not a gap in the chart. */
	const workHeight = (kg: number): number => (workMax === 0 ? 0 : (kg / workMax) * 100);

	// --- Strength -----------------------------------------------------------

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

	const lifts = $derived(mainLifts(data.sessions, since12, factorOf));

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

	// --- Training frequency -------------------------------------------------

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

	// --- Sets per muscle ----------------------------------------------------

	const muscles = $derived(muscleSets(data.workouts, since4, (id) => catalogById[id]));

	/**
	 * One scale for every row, and it is the busiest muscle's total. Normalizing
	 * each bar to its own row would draw Calves at six sets the same length as
	 * Back at fifty, which erases the exact signal this card exists for.
	 */
	const muscleMax = $derived(Math.max(...muscles.map((row) => row.direct + row.indirect)));

	/**
	 * Drawn and named: the muscles with sets get a bar, the muscles without get a
	 * line naming them.
	 *
	 * `muscleSets` still answers with all eleven — a neglected muscle at zero *is*
	 * the answer this card exists for, and that reasoning is intact. What changed
	 * is that eleven bar rows, several of them empty, cost the card 200px to say
	 * something a sentence says in one line. The zeros are still stated, still by
	 * name, and still without the user having to ask.
	 */
	const trained = $derived(muscles.filter((row) => row.direct + row.indirect > 0));
	const untrained = $derived(
		muscles.filter((row) => row.direct + row.indirect === 0).map((row) => row.muscle)
	);

	/**
	 * The direct column alone, because every set has exactly one primary target:
	 * summing both would count a bench press three times over.
	 */
	const totalSets = $derived(muscles.reduce((sum, row) => sum + row.direct, 0));

	// --- Body weight --------------------------------------------------------

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
		<!-- Weekly work — the one card that is mostly chart, so it takes the width
		     rather than drawing twelve bars into half a desk window. -->
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

				<!-- A single series, so no legend: the heading names it. Aria-hidden
				     because the figures above are the accessible copy of the same
				     fact and a row of twelve unlabelled bars is not a second one.

				     Taller at `lg` for the reason the card is full-width at all: the
				     bars divide whatever width they are given, so at 864px they come
				     out 70px across and a 68px chart draws twelve squares. Height is
				     the only lever — capping the bar width instead would left-align
				     the chart in half a card and strand the axis label. -->
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

		<!-- `items-start` is what keeps the grid honest: without it the two columns
		     stretch to the taller, and the left one is a bordered card that would
		     grow a foot of empty surface below its last row. -->
		<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
			<!-- Strength — internal links, so the card is a section, not a door. -->
			<section class={CARD}>
				<h2 class="px-1 label-caps">Strength</h2>

				{#if prs.length === 0 && liftRows.length === 0}
					<p class="px-1 pb-1 {SUB}">No trend yet — a few weeks of sessions draw one.</p>
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
										<span class="tabular-nums">{pr.set.weight} × {pr.set.reps}</span>
									{/snippet}
								</ListRow>
							{/each}

							<!-- In place rather than through a door: there is no screen that
							     lists recent bests, and inventing one to hold four rows would
							     be a screen that fails PRODUCT.md's own test. The state is
							     local and deliberately unremembered — a card that says how you
							     are going should open the same way every time.

							     Full width and centred, closing the list with a hairline: as a
							     `self-start` chip it read as a fourth, broken row. The revealed
							     rows land below it, which is where a disclosure puts them and
							     is the only order that does not shove the button out from under
							     the thumb that pressed it. -->
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
				<!-- Training frequency — the whole card opens History; facts, never streaks. -->
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
									Last 7 days — your usual shows after a full week
								{:else}
									Last 7 days, usually {habitLabel} a week
								{/if}
							</span>
						</span>

						{#if habit.weeks.length > 0}
							<!-- The trailing seven-day windows in faint, the last one in ink. -->
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

				<!-- Sets per muscle — no door: the answer is the whole card. -->
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

									<!-- Both segments on one scale and parted by 2px of card, so a
									     bar's length is comparable across rows and the split inside
									     it is legible without a rule between them. -->
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
							<!-- Two categories, so the legend is not optional. -->
							<div class="flex items-center gap-4 text-xs font-bold text-ink-faint">
								<span class="flex items-center gap-1.5">
									<span aria-hidden="true" class="size-2 rounded-full bg-ink"></span>Direct
								</span>
								<span class="flex items-center gap-1.5">
									<span aria-hidden="true" class="size-2 rounded-full bg-ink-faint/45"
									></span>Indirect
								</span>
							</div>

							<!-- The zeros, by name. Eleven empty bars said this at ten times the
							     height, and a card that has to be scrolled to reveal a neglected
							     muscle is not stating the thing it exists to state. -->
							{#if untrained.length > 0}
								<p class="text-sm font-bold text-ink-faint">
									Nothing on {listFormat.format(untrained)}.
								</p>
							{/if}
						</div>
					{/if}
				</section>

				<!-- Body weight — goal-free by decision: the card states the trend's
				     direction and rate, and the door leads to the screen that logs it. -->
				<a href="/weight" class={DOOR}>
					<span class="flex items-center justify-between px-1">
						<h2 class="label-caps">Body weight</h2>
						<span aria-hidden="true" class="text-xl leading-none text-ink-faint">›</span>
					</span>

					{#if weightNow === null}
						<span class="px-1 pb-1 {SUB}">
							No weigh-ins yet — the trend starts on the Weight screen.
						</span>
					{:else}
						<span class="flex items-end justify-between gap-4 px-1 pb-1">
							<span class="flex flex-col gap-1">
								<span class={HEADLINE}>
									{Math.round(weightNow.kg * 10) / 10}<span class={UNIT}>&nbsp;kg</span>
								</span>

								<span class={SUB}>{rateLabel ?? 'Keep logging — a rate needs two weeks'}</span>
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
