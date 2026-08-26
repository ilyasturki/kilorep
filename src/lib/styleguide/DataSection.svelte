<script lang="ts">
	import { catalogById } from '$lib/catalog';
	import { rollingAverage } from '$lib/domain/bodyweight';
	import EstimatedMax from '$lib/exercises/EstimatedMax.svelte';
	import ExerciseIllustration from '$lib/exercises/ExerciseIllustration.svelte';
	import LoadCalculator from '$lib/exercises/LoadCalculator.svelte';
	import Sparkline from '$lib/progress/Sparkline.svelte';
	import Card from '$lib/styleguide/Card.svelte';
	import Spec from '$lib/styleguide/Spec.svelte';
	import { caption } from '$lib/styleguide/chrome';
	import {
		bench,
		benchSessions,
		bodyweightSeries,
		NOW,
		trendPoints
	} from '$lib/styleguide/fixtures';
	import TrendChart from '$lib/weight/TrendChart.svelte';

	const dots = bodyweightSeries();
	const line = rollingAverage(dots);

	const sessions = benchSessions();

	const points = trendPoints();

	// Nothing is weighed on this page, so the share a bodyweight movement carries is a fixed lifter.
	const carried = () => 78;

	// `chin-up` is not a catalog id — FOLDED maps it onto pull-up's underhand grip. The art is
	// keyed by its own id regardless, which is the point of showing it here.
	const illustrations = ['bench-press', 'cable-fly', 'chin-up', 'barbell-row'];
</script>

<Card name="TrendChart" note="twelve weeks of body weight, dots under a rolling average" wide>
	<TrendChart
		{dots}
		{line}
		today={dots.at(-1)?.date ?? ''}
		from={dots[0]?.date ?? ''}
		range="12 weeks"
	/>
	<span class={caption}>
		the chart measures its own width — it is the one component here that must span
	</span>
</Card>

<Card name="Sparkline" note="the estimate's shape, at a glance">
	<div class="flex flex-wrap items-end gap-6">
		<Spec label="default — 96 × 28">
			<Sparkline {points} />
		</Spec>
		<Spec label="width={160} height={44}">
			<Sparkline {points} width={160} height={44} />
		</Spec>
	</div>
	<span class={caption}>no axes and no scale: it says which way, never how much</span>
</Card>

<Card name="EstimatedMax" note="Epley off the best set, with the calculator folded under it" tall>
	<EstimatedMax exercise={bench} past={sessions} {carried} now={NOW} />
	<span class={caption}>press the caret — LoadCalculator opens inside it</span>
</Card>

<Card name="LoadCalculator" note="what to put on the bar for 1, 3, 5 and 8" tall>
	<LoadCalculator exercise={bench} carried={0} seed={{ weight: 82.5, reps: 8, rpe: 8 }} />
	<span class={caption}>
		carried={'{'}0{'}'} — a barbell moves what is on it. A chin-up passes the lifter's share instead.
	</span>
</Card>

<Card name="ExerciseIllustration" note="traced line art, fetched per exercise id">
	<div class="flex flex-wrap items-center gap-4">
		{#each illustrations as id (id)}
			<div class="flex flex-col items-center gap-1.5">
				<div class="grid size-20 place-items-center rounded-xl bg-sunken">
					<ExerciseIllustration {id} name={catalogById[id]?.name ?? id} class="size-16" />
				</div>
				<span class={caption}>{id}</span>
			</div>
		{/each}
		<div class="flex flex-col items-center gap-1.5">
			<div class="grid size-20 place-items-center rounded-xl bg-sunken">
				<ExerciseIllustration id="no-such-exercise" name="Nothing" class="size-16" />
			</div>
			<span class={caption}>no art — renders nothing, never a broken frame</span>
		</div>
	</div>
	<span class={caption}>
		art is keyed by its own id — chin-up has a drawing without being a catalog entry
	</span>
</Card>
