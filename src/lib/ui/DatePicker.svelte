<script lang="ts" module>
	import { getLocalTimeZone } from '@internationalized/date';

	const nav =
		'focus-ring grid size-10 place-items-center rounded-xl text-2xl leading-none ' +
		'font-bold text-ink-muted hover:bg-surface-2 active:bg-surface-2 ' +
		'data-disabled:pointer-events-none data-disabled:opacity-30';

	// Both the hover fill and the today ink are scoped to `not-data-selected:`
	// rather than trusted to lose a tie. Tailwind resolves conflicts by
	// stylesheet order, not by which variant looks more specific, and today's
	// ink is the case that proves it: on the day that is both today and
	// selected, `text-accent-text` was winning and painting lime-700 on the
	// lime-400 fill at about 2.3:1.
	const day =
		'focus-ring mx-auto grid size-10 place-items-center rounded-xl text-base font-bold ' +
		'not-data-selected:hover:bg-surface-2 ' +
		'not-data-selected:data-today:text-accent-text ' +
		'data-selected:bg-accent data-selected:text-on-accent ' +
		'data-outside-month:opacity-30 ' +
		'data-disabled:pointer-events-none data-disabled:opacity-30 ' +
		'data-unavailable:pointer-events-none data-unavailable:line-through';

	// Neither depends on an instance, and both are the kind of thing that is
	// cheap once and wasteful per field.
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
	import { wideViewport } from '$lib/ui/viewport';

	/**
	 * A calendar day: backdating a body-weight entry, correcting the date on a
	 * workout logged after the fact.
	 *
	 * Calendar, not Bits UI's full DatePicker. The half we skipped is DateField —
	 * the segmented 07 / 28 / 2026 thing you arrow through — which is desktop
	 * form furniture. Nobody types a date segment-by-segment on a phone, and
	 * this app's date has exactly two plausible values: today and a day last
	 * week.
	 *
	 * Which is why `maxToday` exists and why Today is a button rather than a
	 * cell you hunt for: the common case should cost one tap.
	 *
	 * The month rides the same two-element split as Select — `ContentStatic` on
	 * `overlay-sheet` below `sm`, `Content` anchored under the trigger from `sm`
	 * up — for the reason written out there, and through the same `viewport.ts`
	 * read so the two pickers can never disagree about where the line is. The
	 * calendar is the case that makes it obvious: a grid is a small, dense,
	 * self-contained object, and blacking out the page to show one is theatre.
	 *
	 * The month arrows are `‹` and `›`, characters — the subset carries both
	 * (measured: U+2039 and U+203A present) — so per the icons README no caret
	 * is drawn for them. The trigger's calendar mark has no character to be.
	 *
	 * The value is a `DateValue` and not an ISO string, so the dependency
	 * reaches every consumer. That is a deliberate call: callers get real
	 * calendar arithmetic instead of parsing strings back into dates.
	 */
	type Props = {
		label: string;
		value?: DateValue;
		/**
		 * Clamp the calendar to today. A body weight cannot be logged forward.
		 * An explicit `maxValue` is the more specific statement and wins.
		 */
		maxToday?: boolean;
		minValue?: DateValue;
		maxValue?: DateValue;
		/** 0 Sunday … 6 Saturday. Monday by default: the training week is ISO. */
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
		error?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: ClassValue;
	};

	let {
		label,
		value = $bindable(),
		maxToday = false,
		minValue,
		maxValue,
		weekStartsOn = 1,
		error,
		placeholder = 'Choose a date',
		disabled = false,
		class: klass
	}: Props = $props();

	let open = $state(false);

	const max = $derived(maxValue ?? (maxToday ? today(zone) : undefined));

	// The month the calendar opens on. Bound so paging survives a close/reopen
	// within the same session, and so it starts on the selected date's month
	// rather than always on this one.
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
		bind:placeholder={month}
		{minValue}
		maxValue={max}
		{weekStartsOn}
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
		<!-- No scrim and no header, as on Select: the trigger stays visible and
		     Bits UI closes on outside pointerdown and on Escape. The width is
		     fixed rather than the trigger's — a month is 7 × 40px of cell plus the
		     grid's own gutters, and stretching that to match a full-width field
		     would leave a small calendar adrift in a wide box. -->
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
				<SheetHeader title={label} onclose={() => (open = false)} />
				{@render body()}
			</Popover.ContentStatic>
		</Popover.Portal>
	{/if}
{/snippet}

<Field {label} {error} class={klass}>
	{#snippet children({ id, describedBy, invalid })}
		<Popover.Root bind:open>
			<Popover.Trigger
				{id}
				{disabled}
				aria-invalid={invalid}
				aria-describedby={describedBy}
				class={[
					'field-box field-trigger min-h-row focus-ring',
					error ? 'border-danger' : 'border-line'
				]}
			>
				<span class={['truncate', !display && 'text-ink-faint']}>{display || placeholder}</span>
				<CalendarIcon size={18} class="shrink-0 text-ink-muted" />
			</Popover.Trigger>

			{@render panel()}
		</Popover.Root>
	{/snippet}
</Field>
