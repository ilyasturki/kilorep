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
import { parseDate } from '@internationalized/date'

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
            class="datepicker-field"
            :class="props.class"
            :aria-label="ariaLabel"
        >
            <DatePickerInput
                v-for="(item, i) in segments"
                :key="`${item.part}-${i}`"
                :part="item.part"
                class="datepicker-seg"
                :class="{ 'datepicker-seg--literal': item.part === 'literal' }"
            >
                {{ item.value }}
            </DatePickerInput>
            <DatePickerTrigger class="datepicker-trigger">
                <Icon
                    name="tabler:calendar"
                    :size="15"
                />
            </DatePickerTrigger>
        </DatePickerField>

        <DatePickerContent
            class="datepicker-content"
            :side-offset="6"
        >
            <DatePickerArrow class="datepicker-arrow" />
            <DatePickerCalendar
                v-slot="{ weekDays, grid }"
                class="datepicker-cal"
            >
                <DatePickerHeader class="datepicker-cal-head">
                    <DatePickerPrev class="datepicker-nav">
                        <Icon
                            name="tabler:chevron-left"
                            :size="16"
                        />
                    </DatePickerPrev>
                    <DatePickerHeading class="datepicker-heading" />
                    <DatePickerNext class="datepicker-nav">
                        <Icon
                            name="tabler:chevron-right"
                            :size="16"
                        />
                    </DatePickerNext>
                </DatePickerHeader>
                <DatePickerGrid
                    v-for="month in grid"
                    :key="month.value.toString()"
                    class="datepicker-grid"
                >
                    <DatePickerGridHead>
                        <DatePickerGridRow class="datepicker-row">
                            <DatePickerHeadCell
                                v-for="day in weekDays"
                                :key="day"
                                class="datepicker-weekday"
                            >
                                {{ day }}
                            </DatePickerHeadCell>
                        </DatePickerGridRow>
                    </DatePickerGridHead>
                    <DatePickerGridBody>
                        <DatePickerGridRow
                            v-for="(week, i) in month.rows"
                            :key="`week-${i}`"
                            class="datepicker-row"
                        >
                            <DatePickerCell
                                v-for="weekDate in week"
                                :key="weekDate.toString()"
                                :date="weekDate"
                            >
                                <DatePickerCellTrigger
                                    :day="weekDate"
                                    :month="month.value"
                                    class="datepicker-day"
                                />
                            </DatePickerCell>
                        </DatePickerGridRow>
                    </DatePickerGridBody>
                </DatePickerGrid>
            </DatePickerCalendar>
        </DatePickerContent>
    </DatePickerRoot>
</template>
