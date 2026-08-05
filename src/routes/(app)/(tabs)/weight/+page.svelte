<script lang="ts">
	import type { DateValue } from '@internationalized/date';
	import { parseDate } from '@internationalized/date';

	import { fillAppBar } from '$lib/nav/bar.svelte';
	import type { BodyweightEntry, ChartRange } from '$lib/domain/bodyweight';
	import { inRange, localDateOf, rangeStart, rollingAverage } from '$lib/domain/bodyweight';
	import { syncSoon } from '$lib/sync/client';
	import EntryRowMenu from '$lib/weight/EntryRowMenu.svelte';
	import { formatSheetDay } from '$lib/weight/label';
	import LogList from '$lib/weight/LogList.svelte';
	import TrendChart from '$lib/weight/TrendChart.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Segmented from '$lib/ui/Segmented.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Gauge from '$lib/ui/icons/Gauge.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';
	import { press } from '$lib/ui/press';

	import type { PageProps } from './$types';

	/**
	 * The Weight screen: log on top, trend under it, the entries under that —
	 * in that order because the screen's daily job is the log, and a chart
	 * headline would make it a reading screen that happens to log.
	 *
	 * On a desk that order becomes a shape rather than a stack. Today's field
	 * flattens into a bar across the top and the two reading surfaces divide the
	 * space beneath it, which is the one arrangement that spends the extra width
	 * on the *act*: every two-column variant tried first put the stepper in a
	 * 320px rail, narrower than the same control gets on a phone.
	 *
	 * PRODUCT.md's whole model is one line — date + kg, one per day,
	 * re-logging overwrites — and the interactions keep to it: today's field
	 * opens on the most recent entry the way a set row opens on its hint, a
	 * past day is corrected or backfilled from its row, and a delete is the
	 * row's edit sheet's second act.
	 */
	let { data }: PageProps = $props();

	/**
	 * The page owns the live list; the load's copy is where it starts. Read
	 * once by design, the same bargain History's detail strikes — every path
	 * back in re-enters through the tab.
	 */
	// svelte-ignore state_referenced_locally
	const entries = $state(data.entries);

	/**
	 * Captured once per mount, like the exercise detail's `now`: a screen left
	 * open across midnight mislabels "today" until the next navigation, and
	 * that is a cheaper wrong than a clock ticking under a half-typed entry.
	 */
	const today = localDateOf(new Date());

	const todayEntry = $derived(entries.find((entry) => entry.date === today) ?? null);
	const latest = $derived(entries.at(-1) ?? null);

	/**
	 * The field opens on today's entry when one exists, else on the most
	 * recent weigh-in — tomorrow's weight is approximately today's, the same
	 * recall idiom the set row runs on. `recalled` is what the stepper's tint
	 * measures deviation against, so logging settles the colour back to ink.
	 */
	// svelte-ignore state_referenced_locally
	let kg = $state<number | null>(
		data.entries.find((entry) => entry.date === today)?.kg ?? data.entries.at(-1)?.kg ?? null
	);

	const recalled = $derived(todayEntry === null ? (latest?.kg ?? null) : todayEntry.kg);

	/**
	 * Inert once today's number is on the record and the field still shows it:
	 * there is nothing left to claim. One tap logs the recalled value on a
	 * fresh day — the check committing the hint, deliberately.
	 */
	const settled = $derived(kg === null || (todayEntry !== null && kg === todayEntry.kg));

	function upsert(entry: BodyweightEntry) {
		const at = entries.findIndex((existing) => existing.date === entry.date);

		if (at === -1) {
			entries.push(entry);
			entries.sort((a, b) => (a.date < b.date ? -1 : 1));
		} else {
			entries[at] = entry;
		}
	}

	async function save(entry: BodyweightEntry) {
		upsert(entry);

		await data.store.saveBodyweight(entry, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	async function logToday() {
		if (kg === null) {
			return;
		}

		await save({ date: today, kg });
	}

	/**
	 * How far back the trend is drawn, and it outlives the visit: the load hands
	 * over what the store remembers, and every change writes it straight back.
	 * A synced preference rather than a local one — see `WeightRangePreference`.
	 */
	// svelte-ignore state_referenced_locally
	let range = $state<ChartRange>(data.range);

	const RANGES = [
		{ value: '12w', label: '12w' },
		{ value: '6mo', label: '6mo' },
		{ value: '1y', label: '1y' },
		{ value: 'all', label: 'All' }
	] as const;

	const SPOKEN: Record<ChartRange, string> = {
		'12w': 'last 12 weeks',
		'6mo': 'last 6 months',
		'1y': 'last year',
		all: 'all time'
	};

	async function chooseRange(next: string) {
		range = next as ChartRange;

		await data.store.setWeightRange(range, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	// The average runs over the whole log and is windowed after, so the first
	// visible points rest on the days just before the window rather than
	// opening artificially jumpy.
	const chartFrom = $derived(rangeStart(entries, today, range));
	const chartDots = $derived(inRange(entries, today, range));
	const chartLine = $derived(inRange(rollingAverage(entries), today, range));

	/**
	 * One sheet for both gestures against a past day: correcting a row (date
	 * fixed, delete offered) and backfilling (date picked, clamped to today).
	 * A date that already holds an entry saves as an overwrite — the same
	 * "one per day" put every write here is.
	 */
	let sheetOpen = $state(false);
	let sheetFixed = $state(false);
	let sheetDate = $state<DateValue | undefined>();
	let sheetKg = $state<number | null>(null);
	let sheetRecalled = $state<number | null>(null);

	function openEdit(entry: BodyweightEntry) {
		sheetFixed = true;
		sheetDate = parseDate(entry.date);
		sheetKg = entry.kg;
		sheetRecalled = entry.kg;
		sheetOpen = true;
	}

	function openBackfill() {
		sheetFixed = false;
		sheetDate = undefined;
		sheetKg = latest === null ? null : latest.kg;
		sheetRecalled = latest === null ? null : latest.kg;
		sheetOpen = true;
	}

	const sheetTitle = $derived(
		sheetFixed && sheetDate !== undefined
			? formatSheetDay(sheetDate.toString(), today)
			: 'Log a past day'
	);

	/** The entry a backfill would overwrite, surfaced rather than sprung. */
	const replaces = $derived.by(() => {
		if (sheetFixed || sheetDate === undefined) {
			return null;
		}

		// Read once outside the callback: the closure can outlive the narrowing.
		const date = sheetDate.toString();

		return entries.find((entry) => entry.date === date) ?? null;
	});

	async function saveSheet() {
		if (sheetDate === undefined || sheetKg === null) {
			return;
		}

		const entry = { date: sheetDate.toString(), kg: sheetKg };

		await save(entry);

		// A correction to today's record settles the top field too, or it would
		// sit tinted against a number that just moved under it.
		if (entry.date === today) {
			kg = entry.kg;
		}

		sheetOpen = false;
	}

	async function removeEntry(date: string) {
		const at = entries.findIndex((entry) => entry.date === date);

		if (at !== -1) {
			entries.splice(at, 1);
		}

		await data.store.deleteBodyweight(date, Date.now());

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	/**
	 * The day a confirmed Delete would remove, and the only thing the dialog
	 * needs to know. Held here rather than read back off the sheet because both
	 * gestures end in this dialog — the sheet's trash and a held row's ⋯ — and
	 * only one of them has a sheet open behind it.
	 */
	let doomed = $state<string | null>(null);
	let confirmOpen = $state(false);

	function askDelete(date: string) {
		doomed = date;
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (doomed === null) {
			return;
		}

		await removeEntry(doomed);

		doomed = null;
		// Closed after the fact rather than before: the sheet is what the dialog
		// was asked from, and dropping it first would animate the panel away under
		// a question still on screen.
		sheetOpen = false;
	}

	let menuOpen = $state(false);
	let menuAnchor = $state<HTMLElement | null>(null);
	let held = $state<BodyweightEntry | null>(null);

	function hold(anchor: HTMLElement, entry: BodyweightEntry) {
		held = entry;
		menuAnchor = anchor;
		menuOpen = true;
	}

	// UTC over a date-only string, so a negative-offset timezone cannot shift the
	// header onto the day before.
	const day = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});

	fillAppBar(() => ({ title: 'Weight' }));
</script>

<svelte:head>
	<title>Weight | Kilorep</title>
</svelte:head>

<!--
	`column-board` and not `column-content`, for the Dashboard's reason: this is a
	screen of surfaces read beside each other, and it cannot take the step *down*
	that `column-content` makes at `lg` to leave gutter for the Workout rail — a
	rail this screen has no use for.
-->
<main class="column-board flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
	<!--
		The card that becomes a bar. One element and one set of parts, re-flowed
		at `lg` rather than a second component: the desk shape and the phone shape
		have to keep saying the same thing, and two of them is two chances to
		drift.
	-->
	<section
		class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3
			lg:flex-row lg:items-center lg:gap-4 lg:py-2.5 lg:pr-2.5 lg:pl-4"
	>
		<div
			class="flex items-baseline justify-between px-1
				lg:min-w-0 lg:flex-col lg:items-start lg:gap-0.5 lg:px-0"
		>
			<h2 class="label-caps">Today · {day.format(Date.parse(today))}</h2>
			{#if todayEntry !== null}
				<span class="text-sm font-bold text-ink-faint">logged</span>
			{/if}
		</div>

		<StepperField
			bind:value={kg}
			{recalled}
			label="kg"
			step={0.1}
			class="lg:ml-auto lg:min-h-15 lg:w-64 lg:shrink-0"
		/>

		<Button
			variant="commit"
			compact
			disabled={settled}
			class="lg:min-h-15 lg:shrink-0 lg:px-7"
			onclick={() => void logToday()}
		>
			{#if todayEntry === null}
				Log today&rsquo;s weight
			{:else if settled}
				Logged
			{:else}
				Update today
			{/if}
		</Button>
	</section>

	{#if entries.length === 0}
		<EmptyState
			title="No weigh-ins yet"
			description="Log today&rsquo;s weight above and the trend starts here."
		>
			{#snippet icon()}
				<Gauge size={24} />
			{/snippet}
		</EmptyState>

		<!-- Backfill stays reachable before the list exists to carry it: the
		     first entry ever logged may well be yesterday's. -->
		<AddRow label="Log a past day" onclick={openBackfill} />
	{:else}
		<!--
			Two thirds to the chart and one to the log. Not an even split: the chart
			is the only thing on the screen whose readability is a function of its
			width, and a log row is a date and a number that has never needed more
			than a phone's column.
		-->
		<div class="flex flex-col gap-4 lg:grid lg:grid-cols-[2fr_minmax(0,1fr)] lg:items-start">
			<!--
				Sticky at `lg` and nowhere else. The log is a fixed handful of headers
				but two years of them is still a screen and a half, and a chart that
				scrolled away would leave the whole left half of the window blank while
				you read the right. It sticks to the pane rather than to the window —
				the app bar is not fixed, the scroll box under it is.
			-->
			<section
				class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3
					lg:sticky lg:top-0"
			>
				<!-- The heading is the control: a `Last 12 weeks` above a segment
				     already reading `12w` would be the same fact twice, and the one
				     of them that answers back is the one worth the line. -->
				<Segmented
					items={RANGES}
					value={range}
					label="Trend range"
					onchange={(next) => void chooseRange(next)}
				/>

				{#if chartDots.length > 0}
					<TrendChart
						dots={chartDots}
						line={chartLine}
						{today}
						from={chartFrom}
						range={SPOKEN[range]}
					/>
				{:else}
					<p class="px-3 py-8 text-center text-md font-bold text-ink-faint">
						Nothing logged in this range.
					</p>
				{/if}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="px-3 label-caps">Log</h2>

				<LogList {entries} {today} onedit={openEdit} onhold={hold} />

				<AddRow label="Log a past day" onclick={openBackfill} />
			</section>
		</div>
	{/if}
</main>

{#snippet deleteAction()}
	<button
		type="button"
		aria-label="Delete this weigh-in"
		onclick={() => sheetDate !== undefined && askDelete(sheetDate.toString())}
		class="grid size-10 shrink-0 place-items-center rounded-full text-danger
			focus-ring hover:bg-hover press:bg-surface-2"
		{@attach press()}
	>
		<Trash size={18} />
	</button>
{/snippet}

<Sheet bind:open={sheetOpen} title={sheetTitle} action={sheetFixed ? deleteAction : undefined}>
	<div class="flex flex-col gap-3 pt-1">
		{#if !sheetFixed}
			<DatePicker label="Day" bind:value={sheetDate} maxToday />

			{#if replaces !== null}
				<p class="px-1 text-sm font-bold text-ink-faint">
					Replaces the {replaces.kg} kg already logged that day.
				</p>
			{/if}
		{/if}

		<StepperField bind:value={sheetKg} recalled={sheetRecalled} label="kg" step={0.1} />

		<Button
			variant="commit"
			compact
			disabled={sheetDate === undefined || sheetKg === null}
			onclick={() => void saveSheet()}
		>
			Save
		</Button>
	</div>
</Sheet>

<EntryRowMenu
	bind:open={menuOpen}
	title={held === null ? '' : formatSheetDay(held.date, today)}
	anchor={menuAnchor}
	onedit={() => held !== null && openEdit(held)}
	ondelete={() => {
		if (held !== null) askDelete(held.date);
	}}
/>

<!-- `stacked` only when it was asked from the sheet: raised from a held row
     there is nothing above the page for it to clear. -->
<AlertDialog
	bind:open={confirmOpen}
	stacked={sheetOpen}
	title="Delete this weigh-in?"
	description="The day leaves the log and the trend, on every device."
	confirmLabel="Delete"
	onconfirm={() => void confirmDelete()}
/>
