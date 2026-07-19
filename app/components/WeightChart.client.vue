<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import {
    Chart,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    TimeScale,
    Tooltip,
} from 'chart.js'

// Registers the date-fns adapter on Chart.js's global registry, which the time
// scale below resolves at construction time; there is nothing to bind.
// oxlint-disable-next-line import/no-unassigned-import
import 'chartjs-adapter-date-fns'

import { Line } from 'vue-chartjs'

import { appLocale } from '~/utils/appLocale'

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip,
    Filler,
)

const props = defineProps<{
    // x is epoch milliseconds at local midnight; the parent owns range filtering.
    points: { x: number; y: number }[]
    timeUnit: 'day' | 'week' | 'month'
}>()

// Read the live design tokens off :root so the canvas matches the rest of the
// UI, and re-read them when the system theme flips (the canvas can't inherit CSS
// the way the DOM does).
const theme = ref({
    accent: '#c5f53a',
    tick: '#9a9aa0',
    grid: 'rgba(255, 255, 255, 0.1)',
})
function readTheme() {
    const root = getComputedStyle(document.documentElement)
    const css = (name: string, fallback: string) =>
        root.getPropertyValue(name).trim() || fallback
    theme.value = {
        accent: css('--accent', '#c5f53a'),
        tick: css('--ink-3', '#9a9aa0'),
        grid: css('--line', 'rgba(255, 255, 255, 0.1)'),
    }
}

let media: MediaQueryList | undefined
onMounted(() => {
    readTheme()
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', readTheme)
})
onBeforeUnmount(() => media?.removeEventListener('change', readTheme))

const chartData = computed<ChartData<'line'>>(() => ({
    datasets: [
        {
            data: props.points,
            borderColor: theme.value.accent,
            // The volt accent is identical in both themes, so a fixed translucent
            // fill stays on-brand without canvas color-mix() support.
            backgroundColor: 'rgba(197, 245, 58, 0.12)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            // Hide markers once the series is dense enough that they'd smear into
            // the line; keep them on a short history so single weigh-ins read.
            pointRadius: props.points.length <= 60 ? 3 : 0,
            pointBackgroundColor: theme.value.accent,
            pointBorderColor: theme.value.accent,
            pointHoverRadius: 5,
        },
    ],
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // Match the rest of the app: format axis ticks in the active locale.
    locale: appLocale.value,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            displayColors: false,
            callbacks: {
                title: (items: TooltipItem<'line'>[]) =>
                    fmtDate(new Date(items[0]!.parsed.x ?? 0)),
                label: (item: TooltipItem<'line'>) =>
                    `${fmtWeight(item.parsed.y ?? 0)} kg`,
            },
        },
    },
    scales: {
        x: {
            type: 'time',
            time: { unit: props.timeUnit },
            grid: { display: false },
            border: { color: theme.value.grid },
            ticks: {
                color: theme.value.tick,
                maxRotation: 0,
                autoSkipPadding: 16,
            },
        },
        y: {
            grid: { color: theme.value.grid },
            border: { display: false },
            ticks: { color: theme.value.tick },
        },
    },
}))
</script>

<template>
    <Line
        :data="chartData"
        :options="chartOptions"
    />
</template>
