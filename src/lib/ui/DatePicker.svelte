<script lang="ts" module>
	import { getLocalTimeZone } from '@internationalized/date';

	const nav =
		'focus-ring grid size-10 place-items-center rounded-xl text-2xl leading-none ' +
		'font-bold text-ink-muted hover:bg-hover active:bg-surface-2 ' +
		'data-disabled:pointer-events-none data-disabled:opacity-30';

	const day =
		'focus-ring mx-auto grid size-10 place-items-center rounded-xl text-base font-bold ' +
		'not-data-selected:hover:bg-hover ' +
		'not-data-selected:data-today:text-accent-text ' +
		'data-selected:bg-accent data-selected:text-on-accent ' +
		'data-outside-month:opacity-30 ' +
		'data-disabled:pointer-events-none data-disabled:opacity-30 ' +
		'data-unavailable:pointer-events-none data-unavailable:line-through';

	const zone = getLocalTimeZone();

	const formatter = new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import type { DateValue } from '@internationalized/date';
	import { today } from '@internationalized/date';
	import { Calendar, Popover } from 'bits-ui';
	import Button from '$lib/ui/Button.svelte';
	import Field from '$lib/ui/Field.svelte';
	import SheetHeader from '$lib/ui/SheetHeader.svelte';
	import CalendarIcon from '$lib/ui/icons/Calendar.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		label: string;
		value?: DateValue;
		maxToday?: boolean;
		class?: ClassValue;
	};

	let { label, value = $bindable(), maxToday = false, class: klass }: Props = $props();

	let open = $state(false);

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	const max = $derived(maxToday ? today(zone) : undefined);

	let month = $state<DateValue>(value ?? today(zone));

	const display = $derived(value ? formatter.format(value.toDate(zone)) : '');

	function selectToday() {
		value = today(zone);
		open = false;
	}
</script>

{#snippet body()}
	<Calendar.Root
		type="single"
		bind:value
		onValueChange={(picked) => {
			// Picking a day is the panel's whole question answered, so it leaves
			// with the answer — the same close `selectToday` performs, found the
			// hard way: a panel that stayed open sat over the sheet under it and
			// swallowed the Save tap. Deselecting (undefined) is not an answer.
			if (picked !== undefined) {
				open = false;
			}
		}}
		bind:placeholder={month}
		maxValue={max}
		weekStartsOn={1}
		weekdayFormat="short"
		class="min-h-0 flex-1 overflow-y-auto px-4"
	>
		{#snippet children({ months, weekdays })}
			<Calendar.Header class="flex items-center justify-between pb-1">
				<Calendar.PrevButton class={nav} aria-label="Previous month">‹</Calendar.PrevButton>
				<Calendar.Heading class="text-base font-extrabold tracking-tight" />
				<Calendar.NextButton class={nav} aria-label="Next month">›</Calendar.NextButton>
			</Calendar.Header>

			{#each months as calendarMonth (calendarMonth.value.toString())}
				<Calendar.Grid class="w-full table-fixed border-collapse">
					<Calendar.GridHead>
						<Calendar.GridRow>
							{#each weekdays as weekday (weekday)}
								<Calendar.HeadCell class="pb-1 text-center label-caps">
									{weekday.slice(0, 2)}
								</Calendar.HeadCell>
							{/each}
						</Calendar.GridRow>
					</Calendar.GridHead>

					<Calendar.GridBody>
						{#each calendarMonth.weeks as week, index (index)}
							<Calendar.GridRow>
								{#each week as date (date.toString())}
									<Calendar.Cell {date} month={calendarMonth.value} class="p-0.5 text-center">
										<Calendar.Day class={day} />
									</Calendar.Cell>
								{/each}
							</Calendar.GridRow>
						{/each}
					</Calendar.GridBody>
				</Calendar.Grid>
			{/each}
		{/snippet}
	</Calendar.Root>

	<div class="px-4 pt-3">
		<Button variant="secondary" class="w-full" onclick={selectToday}>Today</Button>
	</div>
{/snippet}

{#snippet panel()}
	{#if wideViewport.current}
		<Popover.Portal>
			<Popover.Content
				sideOffset={6}
				class="overlay-menu max-h-[min(30rem,var(--bits-popover-content-available-height))] w-80
					py-3"
			>
				{@render body()}
			</Popover.Content>
		</Popover.Portal>
	{:else}
		<Popover.Portal>
			<Popover.Overlay class="overlay-scrim" />

			<Popover.ContentStatic class="overlay-panel overlay-sheet">
				<SheetHeader title={label} />
				{@render body()}
			</Popover.ContentStatic>
		</Popover.Portal>
	{/if}
{/snippet}

<Field {label} class={klass}>
	{#snippet children({ id, describedBy, invalid })}
		<Popover.Root bind:open>
			<Popover.Trigger
				{id}
				aria-invalid={invalid}
				aria-describedby={describedBy}
				class="field-box field-trigger min-h-row border-line focus-ring"
			>
				<span class={['truncate', !display && 'text-ink-faint']}>{display || 'Choose a date'}</span>
				<CalendarIcon size={18} class="shrink-0 text-ink-muted" />
			</Popover.Trigger>

			{@render panel()}
		</Popover.Root>
	{/snippet}
</Field>
