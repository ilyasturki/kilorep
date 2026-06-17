<script setup lang="ts">
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    LinearScale,
    Tooltip,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

import { appLocale } from '~/utils/appLocale'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps<{
    // One bar per bucket, oldest first. `label` is the x-axis tick (short date),
    // `value` the bucket's total volume in kilograms.
    points: { label: string; value: number }[]
}>()

// Read the live design tokens off :root so the canvas matches the rest of the
// UI, and re-read them when the system theme flips (the canvas can't inherit CSS
// the way the DOM does). Mirrors WeightChart.
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

const chartData = computed<ChartData<'bar'>>(() => ({
    labels: props.points.map((p) => p.label),
    datasets: [
        {
            data: props.points.map((p) => p.value),
            backgroundColor: theme.value.accent,
            borderRadius: 4,
            // Cap bar width so a sparse 8-week history doesn't show slabs.
            maxBarThickness: 28,
        },
    ],
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    locale: appLocale.value,
    plugins: {
        legend: { display: false },
        tooltip: {
            displayColors: false,
            callbacks: {
                label: (item: TooltipItem<'bar'>) =>
                    `${fmtVolume(item.parsed.y ?? 0)} kg`,
            },
        },
    },
    scales: {
        x: {
            grid: { display: false },
            border: { color: theme.value.grid },
            ticks: { color: theme.value.tick, maxRotation: 0 },
        },
        y: {
            grid: { color: theme.value.grid },
            border: { display: false },
            ticks: {
                color: theme.value.tick,
                // Volume runs into the thousands; the locale grouping keeps the
                // axis readable.
                callback: (value) => fmtVolume(Number(value)),
            },
        },
    },
}))
</script>

<template>
    <Bar
        :data="chartData"
        :options="chartOptions"
    />
</template>
