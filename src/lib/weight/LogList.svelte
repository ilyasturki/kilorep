<script lang="ts">
	import type { BodyweightEntry } from '$lib/domain/bodyweight';
	import { monthGroups } from '$lib/domain/bodyweight';
	import { formatLogDay, formatMonth, formatMonthMeta } from '$lib/weight/label';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import { press } from '$lib/ui/press';

	/**
	 * The log, by month, newest first.
	 *
	 * A flat list of every day was honest and unbounded: weigh in daily for two
	 * years and the screen is seven hundred rows of one number, which is a
	 * scrollbar rather than a record. Grouped, the page is a fixed handful of
	 * headers however long the log gets, and the header earns its line by
	 * carrying what the days under it could not say on their own — what the month
	 * averaged, and which way it moved.
	 *
	 * One month at a time. Opening a month closes the one that was open, and
	 * tapping the open one closes it too — so "everything folded to headers" is
	 * a state you can reach on purpose, and it is the best reading of the log
	 * there is: twelve lines, each an average and a direction. Left free, months
	 * accumulated open behind you and the record you were trying to read became
	 * the scrollbar the grouping exists to prevent.
	 *
	 * The newest month opens. Not "the current month": a log whose last
	 * weigh-in was in June should open on June rather than on an empty August,
	 * and "the first group" is the same rule for both cases without a branch.
	 *
	 * Which month is open is deliberately unremembered. It is a reading
	 * posture, not a setting, and a screen that reopened on a month because of
	 * something you did last Tuesday is one you have to re-tidy before you can
	 * read it.
	 */
	type Props = {
		entries: BodyweightEntry[];
		today: string;
		onedit: (entry: BodyweightEntry) => void;
		onhold: (anchor: HTMLElement, entry: BodyweightEntry) => void;
	};

	let { entries, today, onedit, onhold }: Props = $props();

	const groups = $derived(monthGroups(entries));

	/**
	 * The open month, keyed by month rather than by index so a backfill that
	 * inserts a new month above does not slide the open group down onto its
	 * neighbour.
	 *
	 * Three states, and the third is why this is not a plain `string | null`:
	 * `undefined` is *untouched*, which reads as the newest month whatever that
	 * turns out to be, while `null` is a deliberate all-closed. Seeding with
	 * `groups[0].month` instead would have to be re-seeded every time the newest
	 * month changed under it — and would seed to nothing at all on a log that
	 * has no months yet when it mounts.
	 */
	let chosen = $state<string | null | undefined>();

	const isOpen = (month: string, index: number) =>
		chosen === undefined ? index === 0 : chosen === month;

	function toggle(month: string, index: number) {
		chosen = isOpen(month, index) ? null : month;
	}
</script>

<!--
	One card for the whole log, not a card per month. `list-group` parts its own
	direct children with a hairline, and both a header and an open month's rows
	are direct children of it — so the months read as one continuous record with
	headings in it, rather than as a stack of twenty-five separate objects.
-->
<div class="list-group">
	{#each groups as group, index (group.month)}
		{@const open = isOpen(group.month, index)}
		{@const panelId = `log-month-${group.month}`}

		<!-- A button rather than a ListRow: this is the group's heading, and a
		     row's title styling would put a month in the same voice as the days
		     inside it. `min-h-row-dense` for the same reason the Dashboard's rows
		     take it — a header is read, not thumbed through. -->
		<button
			type="button"
			aria-expanded={open}
			aria-controls={panelId}
			onclick={() => toggle(group.month, index)}
			class="flex min-h-row-dense w-full items-center gap-2 px-3 py-2 text-left
				text-ink-faint focus-ring-inset hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<!-- The same way round as the Dashboard's and the plan card's. -->
			<CaretDown size={14} class={open ? 'rotate-180' : ''} />

			<span class="label-caps">{formatMonth(group.month)}</span>

			<span class="ml-auto text-sm font-bold tabular-nums">
				{formatMonthMeta(group.average, group.change)}
			</span>
		</button>

		{#if open}
			<!-- `list-group` only parts its own direct children, and the rows are a
			     generation further down — the wrapper exists so `aria-controls` has
			     something to point at. Same hairline, said again for the rows. -->
			<div id={panelId} class="flex flex-col [&>*+*]:border-t [&>*+*]:border-line-soft">
				{#each group.entries as entry (entry.date)}
					<ListRow
						title={formatLogDay(entry.date, today)}
						chevron={false}
						dense
						onclick={() => onedit(entry)}
						onhold={(anchor) => onhold(anchor, entry)}
					>
						{#snippet trailing()}
							{entry.kg} kg
						{/snippet}
					</ListRow>
				{/each}
			</div>
		{/if}
	{/each}
</div>
