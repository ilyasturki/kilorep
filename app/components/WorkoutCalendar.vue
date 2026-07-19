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

const DAY_CELL =
    'flex min-h-[52px] flex-col items-center justify-center gap-[5px] border-none bg-transparent font-mono text-body-sm select-none'

// Days with a workout are the only interactive cells — a tap opens that day's
// most recent workout, so only they carry the hover treatment.
const DAY_HAS =
    'transition-[background,color] duration-[120ms] hover:bg-surface-2 hover:text-accent-ink'
</script>

<template>
    <div class="border border-line-2 bg-surface p-4">
        <div class="mb-3.5 flex items-center justify-between">
            <button
                type="button"
                class="inline-flex size-[30px] items-center justify-center border border-line bg-surface text-ink-2 transition-[border-color,color] duration-[120ms] hover:border-accent hover:text-ink"
                aria-label="Previous month"
                @click="cursor = addMonths(cursor, -1)"
            >
                <Icon
                    name="tabler:chevron-left"
                    :size="16"
                />
            </button>
            <span
                class="font-mono text-body-sm font-semibold tracking-[0.02em] text-ink uppercase"
                >{{ heading }}</span
            >
            <button
                type="button"
                class="inline-flex size-[30px] items-center justify-center border border-line bg-surface text-ink-2 transition-[border-color,color] duration-[120ms] hover:border-accent hover:text-ink"
                aria-label="Next month"
                @click="cursor = addMonths(cursor, 1)"
            >
                <Icon
                    name="tabler:chevron-right"
                    :size="16"
                />
            </button>
        </div>

        <div class="grid grid-cols-7">
            <span
                v-for="d in weekdays"
                :key="d"
                class="pb-2 text-center text-micro font-medium text-ink-3 uppercase"
            >
                {{ d }}
            </span>
        </div>

        <div class="grid grid-cols-7 gap-0.5">
            <component
                :is="day.workout ? 'button' : 'div'"
                v-for="day in days"
                :key="day.key"
                :class="[
                    DAY_CELL,
                    day.workout && DAY_HAS,
                    day.outside ? 'text-ink-3' : 'text-ink',
                    isToday(day.date)
                        && 'shadow-[inset_0_0_0_1px_var(--line-2)]',
                ]"
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
                    class="size-[5px] bg-accent"
                    :class="day.outside && 'opacity-50'"
                />
            </component>
        </div>
    </div>
</template>
