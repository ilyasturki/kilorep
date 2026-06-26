<script setup lang="ts">
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns'

import type { WorkoutWithEntries } from '~~/server/database/schema'

const props = defineProps<{ workouts: WorkoutWithEntries[] }>()

// Open on the latest training month, not "now": it always lands on a month that
// has marks, and (unlike new Date()) it's deterministic, so SSR and the client
// agree on the first render. The list arrives newest-first.
const cursor = ref(
    startOfMonth(new Date(props.workouts[0]?.startedAt ?? new Date())),
)

// Monday-start, matching the DatePicker.
const WEEK = { weekStartsOn: 1 } as const

const weekdays = computed(() => weekdayLabels())
const heading = computed(() => fmtMonthYear(cursor.value))

// Group workouts by their local calendar day (the key the rest of the app uses).
// Newest stays first within a day, so [0] is the one a tap opens.
const byDay = computed(() => {
    const map = new Map<string, WorkoutWithEntries[]>()
    for (const w of props.workouts) {
        const key = toDateInput(w.startedAt)
        const list = map.get(key)
        if (list) list.push(w)
        else map.set(key, [w])
    }
    return map
})

const days = computed(() =>
    eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor.value), WEEK),
        end: endOfWeek(endOfMonth(cursor.value), WEEK),
    }).map((date) => {
        const key = toDateInput(date)
        return {
            key,
            date,
            num: date.getDate(),
            outside: !isSameMonth(date, cursor.value),
            workout: byDay.value.get(key)?.[0] ?? null,
        }
    }),
)

// "Today" depends on the clock, so resolve it on the client after mount to keep
// SSR markup stable (same trick as the history list's relative-day labels).
const today = ref<Date>()
onMounted(() => {
    today.value = new Date()
})
const isToday = (d: Date) => (today.value ? isSameDay(d, today.value) : false)

function open(workout: WorkoutWithEntries | null) {
    if (workout) navigateTo(`/workouts/${workout.id}`)
}
</script>

<template>
    <div class="wk-cal">
        <div class="wk-cal-head">
            <button
                type="button"
                class="wk-cal-nav"
                aria-label="Previous month"
                @click="cursor = addMonths(cursor, -1)"
            >
                <Icon
                    name="tabler:chevron-left"
                    :size="16"
                />
            </button>
            <span class="wk-cal-heading">{{ heading }}</span>
            <button
                type="button"
                class="wk-cal-nav"
                aria-label="Next month"
                @click="cursor = addMonths(cursor, 1)"
            >
                <Icon
                    name="tabler:chevron-right"
                    :size="16"
                />
            </button>
        </div>

        <div class="wk-cal-weekrow">
            <span
                v-for="d in weekdays"
                :key="d"
                class="wk-cal-weekday"
            >
                {{ d }}
            </span>
        </div>

        <div class="wk-cal-days">
            <component
                :is="day.workout ? 'button' : 'div'"
                v-for="day in days"
                :key="day.key"
                class="wk-cal-day"
                :class="{
                    'wk-cal-day--has': day.workout,
                    'wk-cal-day--outside': day.outside,
                    'wk-cal-day--today': isToday(day.date),
                }"
                :type="day.workout ? 'button' : undefined"
                :aria-label="
                    day.workout ?
                        `Open workout from ${fmtDate(day.date)}`
                    :   undefined
                "
                @click="open(day.workout)"
            >
                <span>{{ day.num }}</span>
                <span
                    v-if="day.workout"
                    class="wk-cal-dot"
                />
            </component>
        </div>
    </div>
</template>
