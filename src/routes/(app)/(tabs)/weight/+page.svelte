<script lang="ts">
	import type { DateValue } from '@internationalized/date';
	import { parseDate } from '@internationalized/date';

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

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const entries = $state(data.entries);

	const today = localDateOf(new Date());

	const LIGHTEST = 20;
	const HEAVIEST = 300;

	const todayEntry = $derived(entries.find((entry) => entry.date === today) ?? null);
	const latest = $derived(entries.at(-1) ?? null);

	// svelte-ignore state_referenced_locally
	let kg = $state<number | null>(
		data.entries.find((entry) => entry.date === today)?.kg ?? data.entries.at(-1)?.kg ?? null
	);

	const recalled = $derived(todayEntry === null ? (latest?.kg ?? null) : todayEntry.kg);

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

	const chartFrom = $derived(rangeStart(entries, today, range));
	const chartDots = $derived(inRange(entries, today, range));
	const chartLine = $derived(inRange(rollingAverage(entries), today, range));

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

	const replaces = $derived.by(() => {
		if (sheetFixed || sheetDate === undefined) {
			return null;
		}

		const date = sheetDate.toString();

		return entries.find((entry) => entry.date === date) ?? null;
	});

	async function saveSheet() {
		if (sheetDate === undefined || sheetKg === null) {
			return;
		}

		const entry = { date: sheetDate.toString(), kg: sheetKg };

		await save(entry);

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

	// UTC: a date-only string in a negative-offset zone would render the day before.
	const day = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
</script>

<svelte:head>
	<title>Weight | Kilorep</title>
</svelte:head>

<main class="column-board flex min-h-full flex-col gap-4 px-3 pt-3 pb-4">
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
			ruler
			rulerStep={0.05}
			major={10}
			min={LIGHTEST}
			max={HEAVIEST}
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

		<AddRow label="Log a past day" onclick={openBackfill} />
	{:else}
		<div class="flex flex-col gap-4 lg:grid lg:grid-cols-[2fr_minmax(0,1fr)] lg:items-start">
			<section
				class="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface p-3
					lg:sticky lg:top-0"
			>
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

		<StepperField
			bind:value={sheetKg}
			recalled={sheetRecalled}
			label="kg"
			step={0.1}
			min={LIGHTEST}
			max={HEAVIEST}
		/>

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

<AlertDialog
	bind:open={confirmOpen}
	stacked={sheetOpen}
	title="Delete this weigh-in?"
	description="The day leaves the log and the trend, on every device."
	confirmLabel="Delete"
	onconfirm={() => void confirmDelete()}
/>
