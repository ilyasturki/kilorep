<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import {
    DatePickerArrow,
    DatePickerCalendar,
    DatePickerCell,
    DatePickerCellTrigger,
    DatePickerContent,
    DatePickerField,
    DatePickerGrid,
    DatePickerGridBody,
    DatePickerGridHead,
    DatePickerGridRow,
    DatePickerHeadCell,
    DatePickerHeader,
    DatePickerHeading,
    DatePickerInput,
    DatePickerNext,
    DatePickerPrev,
    DatePickerRoot,
    DatePickerTrigger,
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { parseDate } from '@internationalized/date'

const datePicker = tv({
    slots: {
        field: 'inline-flex items-center border border-line-2 bg-surface py-[3px] pr-[3px] pl-2.5 font-mono text-body-sm text-ink transition-[border-color] duration-[120ms] hover:border-accent focus-within:border-accent data-disabled:pointer-events-none data-disabled:opacity-50',
        segment:
            'px-0.5 py-1 text-ink outline-none data-placeholder:text-ink-3 focus:bg-accent focus:text-on-accent',
        trigger:
            'ml-1.5 inline-flex size-[30px] items-center justify-center border-0 bg-transparent text-ink-2 transition-[color,background] duration-[120ms] hover:bg-surface-2 hover:text-ink',
        content:
            'z-[60] border border-line-2 bg-canvas p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]',
        arrow: 'fill-line-2',
        header: 'mb-2.5 flex items-center justify-between',
        heading:
            'font-mono text-body-sm font-semibold tracking-[0.02em] text-ink uppercase',
        nav: 'inline-flex size-7 items-center justify-center border border-line bg-surface text-ink-2 transition-[border-color,color] duration-[120ms] hover:border-accent hover:text-ink',
        grid: 'border-collapse',
        row: 'flex',
        weekday: 'w-[34px] pb-1.5 text-micro font-medium text-ink-3 uppercase',
        day: 'inline-flex size-[34px] items-center justify-center font-mono text-body-sm text-ink select-none transition-[background,color] duration-[120ms] hover:bg-surface-2 data-today:shadow-[inset_0_0_0_1px_var(--line-2)] data-selected:bg-accent data-selected:text-on-accent data-outside-view:text-ink-3 data-disabled:pointer-events-none data-disabled:text-ink-3 data-disabled:line-through data-disabled:opacity-40 data-unavailable:pointer-events-none data-unavailable:text-ink-3 data-unavailable:line-through data-unavailable:opacity-40',
    },
    variants: {
        // Separators sit tight against the numbers and stay quiet.
        literal: { true: { segment: 'px-0 text-ink-3' } },
    },
})

const ui = datePicker()

// `class` is taken as a prop and put on the field: DatePickerRoot renders no
// element of its own, so an inherited class would be dropped on the floor.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
    max?: string
    disabled?: boolean
    ariaLabel?: string
    class?: unknown
}>()

// The rest of the app speaks plain ISO YYYY-MM-DD; reka's field/calendar speak
// DateValue. Bridge here so callers never touch @internationalized/date.
const model = defineModel<string>()

const dateValue = computed<DateValue | undefined>({
    get: () => (model.value ? parseDate(model.value) : undefined),
    set: (value) => {
        model.value = value?.toString()
    },
})

const maxValue = computed(() => (props.max ? parseDate(props.max) : undefined))
</script>

<template>
    <DatePickerRoot
        v-model="dateValue"
        :max-value="maxValue"
        :disabled="disabled"
        :week-starts-on="1"
        close-on-select
    >
        <DatePickerField
            v-slot="{ segments }"
            v-bind="$attrs"
            :class="ui.field({ class: props.class as string })"
            :aria-label="ariaLabel"
        >
            <DatePickerInput
                v-for="(item, i) in segments"
                :key="`${item.part}-${i}`"
                :part="item.part"
                :class="
                    datePicker({ literal: item.part === 'literal' }).segment()
                "
            >
                {{ item.value }}
            </DatePickerInput>
            <DatePickerTrigger :class="ui.trigger()">
                <Icon
                    name="tabler:calendar"
                    :size="15"
                />
            </DatePickerTrigger>
        </DatePickerField>

        <DatePickerContent
            :class="ui.content()"
            :side-offset="6"
        >
            <DatePickerArrow :class="ui.arrow()" />
            <DatePickerCalendar v-slot="{ weekDays, grid }">
                <DatePickerHeader :class="ui.header()">
                    <DatePickerPrev :class="ui.nav()">
                        <Icon
                            name="tabler:chevron-left"
                            :size="16"
                        />
                    </DatePickerPrev>
                    <DatePickerHeading :class="ui.heading()" />
                    <DatePickerNext :class="ui.nav()">
                        <Icon
                            name="tabler:chevron-right"
                            :size="16"
                        />
                    </DatePickerNext>
                </DatePickerHeader>
                <DatePickerGrid
                    v-for="month in grid"
                    :key="month.value.toString()"
                    :class="ui.grid()"
                >
                    <DatePickerGridHead>
                        <DatePickerGridRow :class="ui.row()">
                            <DatePickerHeadCell
                                v-for="day in weekDays"
                                :key="day"
                                :class="ui.weekday()"
                            >
                                {{ day }}
                            </DatePickerHeadCell>
                        </DatePickerGridRow>
                    </DatePickerGridHead>
                    <DatePickerGridBody>
                        <DatePickerGridRow
                            v-for="(week, i) in month.rows"
                            :key="`week-${i}`"
                            :class="ui.row()"
                        >
                            <DatePickerCell
                                v-for="weekDate in week"
                                :key="weekDate.toString()"
                                :date="weekDate"
                            >
                                <DatePickerCellTrigger
                                    :day="weekDate"
                                    :month="month.value"
                                    :class="ui.day()"
                                />
                            </DatePickerCell>
                        </DatePickerGridRow>
                    </DatePickerGridBody>
                </DatePickerGrid>
            </DatePickerCalendar>
        </DatePickerContent>
    </DatePickerRoot>
</template>
