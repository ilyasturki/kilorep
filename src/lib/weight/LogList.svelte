<script lang="ts">
	import type { BodyweightEntry } from '$lib/domain/bodyweight';
	import { monthGroups } from '$lib/domain/bodyweight';
	import { formatLogDay, formatMonth, formatMonthMeta } from '$lib/weight/label';
	import ListRow from '$lib/ui/ListRow.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import { press } from '$lib/ui/press';

	type Props = {
		entries: BodyweightEntry[];
		today: string;
		onedit: (entry: BodyweightEntry) => void;
		onhold: (anchor: HTMLElement, entry: BodyweightEntry) => void;
	};

	let { entries, today, onedit, onhold }: Props = $props();

	const groups = $derived(monthGroups(entries));

	// `undefined` is untouched and reads as the newest month; `null` is a
	// deliberate all-closed.
	let chosen = $state<string | null | undefined>();

	const isOpen = (month: string, index: number) =>
		chosen === undefined ? index === 0 : chosen === month;

	function toggle(month: string, index: number) {
		chosen = isOpen(month, index) ? null : month;
	}
</script>

<div class="list-group">
	{#each groups as group, index (group.month)}
		{@const open = isOpen(group.month, index)}
		{@const panelId = `log-month-${group.month}`}

		<button
			type="button"
			aria-expanded={open}
			aria-controls={panelId}
			onclick={() => toggle(group.month, index)}
			class="flex min-h-row-dense w-full items-center gap-2 px-3 py-2 text-left
				text-ink-faint focus-ring-inset hover:bg-hover press:bg-surface-2"
			{@attach press()}
		>
			<CaretDown size={14} class={open ? 'rotate-180' : ''} />

			<span class="label-caps">{formatMonth(group.month)}</span>

			<span class="ml-auto text-sm font-bold tabular-nums">
				{formatMonthMeta(group.average, group.change)}
			</span>
		</button>

		{#if open}
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
