<script lang="ts">
	import type { DateValue } from '@internationalized/date';
	import { parseDate } from '@internationalized/date';

	import type { BodyweightEntry } from '$lib/domain/bodyweight';
	import { localDateOf, rollingAverage, windowed } from '$lib/domain/bodyweight';
	import { syncSoon } from '$lib/sync/client';
	import EntryRowMenu from '$lib/weight/EntryRowMenu.svelte';
	import TrendChart from '$lib/weight/TrendChart.svelte';
	import AddRow from '$lib/ui/AddRow.svelte';
	import Button from '$lib/ui/Button.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import Gauge from '$lib/ui/icons/Gauge.svelte';
	import Trash from '$lib/ui/icons/Trash.svelte';

	import type { PageProps } from './$types';

	/**
	 * The Weight screen: log on top, trend under it, the entries under that —
	 * in that order because the screen's daily job is the log, and a chart
	 * headline would make it a reading screen that happens to log.
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

	// The average runs over the whole log and is windowed after, so the first
	// visible points rest on the days just before the window rather than
	// opening artificially jumpy.
	const chartDots = $derived(windowed(entries, today, 84));
	const chartLine = $derived(windowed(rollingAverage(entries), today, 84));

	const listed = $derived(entries.toReversed());

	// UTC formatters over date-only strings, so a negative-offset timezone
	// cannot shift a row's label onto the day before.
	const day = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
	const dayWithYear = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});

	function rowTitle(date: string): string {
		const format = date.slice(0, 4) === today.slice(0, 4) ? day : dayWithYear;

		return format.format(Date.parse(date));
	}

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
		sheetFixed && sheetDate !== undefined ? rowTitle(sheetDate.toString()) : 'Log a past day'
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

	/**
	 * Takes the date rather than reading the sheet's, because a held row deletes
	 * without opening one. The sheet's own Delete is now just this with the
	 * sheet's date and a close afterwards.
	 */
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

	async function deleteEntry() {
		if (sheetDate === undefined) {
			return;
		}

		await removeEntry(sheetDate.toString());

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
</script>

<svelte:head>
	<title>Weight | Kilorep</title>
</svelte:head>

<main class="column-content flex min-h-full flex-col gap-4 px-3 pt-safe-t pb-4 lg:pt-3">
	<!-- Gone from `lg` up, same bargain as History: the bar above already says
	     Weight in the lit tab. -->
	<header class="px-1 pt-6 lg:hidden">
		<h1 class="text-2xl font-extrabold tracking-tight">Weight</h1>
	</header>

	<section class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3">
		<div class="flex items-baseline justify-between px-1">
			<h2 class="label-caps">Today · {day.format(Date.parse(today))}</h2>
			{#if todayEntry !== null}
				<span class="text-sm font-bold text-ink-faint">logged</span>
			{/if}
		</div>

		<StepperField bind:value={kg} {recalled} label="kg" step={0.1} />

		<Button variant="commit" compact disabled={settled} onclick={() => void logToday()}>
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
	{:else}
		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Last 12 weeks</h2>

			<div class="rounded-2xl border border-line-soft bg-surface px-1 py-3">
				{#if chartDots.length > 0}
					<TrendChart dots={chartDots} line={chartLine} {today} />
				{:else}
					<p class="px-3 py-8 text-center text-md font-bold text-ink-faint">
						Nothing logged in the last 12 weeks.
					</p>
				{/if}
			</div>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="px-3 label-caps">Log</h2>

			<div class="list-group">
				{#each listed as entry (entry.date)}
					<ListRow
						title={rowTitle(entry.date)}
						chevron={false}
						onclick={() => openEdit(entry)}
						onhold={(anchor) => hold(anchor, entry)}
					>
						{#snippet trailing()}
							{entry.kg} kg
						{/snippet}
					</ListRow>
				{/each}
			</div>

			<AddRow label="Log a past day" onclick={openBackfill} />
		</section>
	{/if}

	{#if entries.length === 0}
		<!-- Backfill stays reachable before the list exists to carry it: the
		     first entry ever logged may well be yesterday's. -->
		<AddRow label="Log a past day" onclick={openBackfill} />
	{/if}
</main>

<Sheet bind:open={sheetOpen} title={sheetTitle}>
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

		{#if sheetFixed}
			<!-- Immediate, like removing a set: the cost of a mis-tap is re-typing
			     one number, and the tombstone syncs like any other write. -->
			<Button variant="destructive" class="self-center" onclick={() => void deleteEntry()}>
				<Trash size={18} />
				Delete entry
			</Button>
		{/if}
	</div>
</Sheet>

<EntryRowMenu
	bind:open={menuOpen}
	title={held === null ? '' : rowTitle(held.date)}
	anchor={menuAnchor}
	onedit={() => held !== null && openEdit(held)}
	ondelete={() => {
		if (held !== null) void removeEntry(held.date);
	}}
/>
