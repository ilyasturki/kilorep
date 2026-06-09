<script setup lang="ts">
import type { Bodyweight } from '~~/server/database/schema'

const {
    data: entries,
    status,
    refresh,
} = await useFetch<Bodyweight[]>('/api/bodyweight')

const toast = useToast()

const toMs = (d: string) => parseLocalDay(d).getTime()
const fmt2 = (n: number) => n.toFixed(2)
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`

const todayStr = toDateInput(new Date())

const RANGES = [
    { key: '1W', label: '1W' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '1Y', label: '1Y' },
    { key: 'all', label: 'All' },
] as const
type RangeKey = (typeof RANGES)[number]['key']

// Default 'all' keeps the server render free of any new Date() math, so the
// stats strip hydrates without a clock-driven mismatch.
const range = ref<RangeKey>('all')
const rangeLabel = computed(
    () => RANGES.find((r) => r.key === range.value)?.label ?? '',
)

function cutoff(): number | null {
    if (range.value === 'all') return null
    const d = new Date()
    if (range.value === '1W') d.setDate(d.getDate() - 7)
    else if (range.value === '1M') d.setMonth(d.getMonth() - 1)
    else if (range.value === '3M') d.setMonth(d.getMonth() - 3)
    else d.setFullYear(d.getFullYear() - 1)
    return d.getTime()
}

const ranged = computed(() => {
    const all = entries.value ?? []
    const cut = cutoff()
    return cut == null ? all : all.filter((e) => toMs(e.date) >= cut)
})

const points = computed(() =>
    ranged.value.map((e) => ({ x: toMs(e.date), y: e.weight })),
)
const timeUnit = computed<'day' | 'week' | 'month'>(() =>
    range.value === '1W' || range.value === '1M' ? 'day'
    : range.value === '3M' ? 'week'
    : 'month',
)

// "Current" is the most recent weigh-in overall, not range-limited.
const latest = computed(() => {
    const all = entries.value ?? []
    return all.length ? all[all.length - 1]! : null
})
const rangeChange = computed(() => {
    const r = ranged.value
    if (r.length < 2) return null
    return Math.round((r[r.length - 1]!.weight - r[0]!.weight) * 100) / 100
})
const minMax = computed(() => {
    const ws = ranged.value.map((e) => e.weight)
    if (!ws.length) return null
    return { min: Math.min(...ws), max: Math.max(...ws) }
})

// Newest-first list with each row's change against the previous (older) entry.
const logRows = computed(() => {
    const rows = (entries.value ?? []).toReversed()
    return rows.map((e, i) => {
        const older = rows[i + 1]
        return {
            ...e,
            delta:
                older ?
                    Math.round((e.weight - older.weight) * 100) / 100
                :   null,
        }
    })
})

type Draft = { date: string; weight: number }
const draft = ref<Draft>({ date: todayStr, weight: 75 })
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

const canSave = computed(() => {
    const { date, weight } = draft.value
    return (
        !!date
        && date <= todayStr
        && typeof weight === 'number'
        && weight >= 20
        && weight <= 400
    )
})

function openAdd() {
    editingId.value = null
    // Seed with the last known weight so a daily weigh-in is a quick nudge.
    draft.value = { date: todayStr, weight: latest.value?.weight ?? 75 }
    formOpen.value = true
}

function openEdit(entry: Bodyweight) {
    editingId.value = entry.id
    draft.value = { date: entry.date, weight: entry.weight }
    formOpen.value = true
}

async function save() {
    if (!canSave.value) return
    saving.value = true
    try {
        if (editingId.value !== null) {
            await $fetch(`/api/bodyweight/${editingId.value}`, {
                method: 'PATCH',
                body: draft.value,
            })
        } else {
            await $fetch('/api/bodyweight', {
                method: 'POST',
                body: draft.value,
            })
        }
        formOpen.value = false
        editingId.value = null
        await refresh()
        toast.add({ title: 'Weight logged', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the weigh-in'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

const deleteTarget = ref<Bodyweight | null>(null)
const deleting = ref(false)

async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    try {
        await $fetch(`/api/bodyweight/${deleteTarget.value.id}`, {
            method: 'DELETE',
        })
        if (editingId.value === deleteTarget.value.id) formOpen.value = false
        deleteTarget.value = null
        await refresh()
        toast.add({ title: 'Weigh-in deleted', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not delete the weigh-in'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}
</script>

<template>
    <div>
        <!-- Stats + log action share a row -->
        <div class="wk-stats mb-5">
            <template v-if="entries?.length">
                <div class="wk-stat">
                    <span class="stat-num mono">
                        {{ latest ? fmt2(latest.weight) : '—' }}
                    </span>
                    <span class="stat-lab">CURRENT · KG</span>
                </div>
                <div class="wk-stat">
                    <span class="stat-num mono">
                        {{ rangeChange == null ? '—' : signed(rangeChange) }}
                    </span>
                    <span class="stat-lab">CHANGE · {{ rangeLabel }}</span>
                </div>
                <div
                    v-if="minMax"
                    class="wk-stat"
                >
                    <span class="stat-num mono">{{ fmt2(minMax.min) }}</span>
                    <span class="stat-lab">LOWEST · KG</span>
                </div>
                <div
                    v-if="minMax"
                    class="wk-stat"
                >
                    <span class="stat-num mono">{{ fmt2(minMax.max) }}</span>
                    <span class="stat-lab">HIGHEST · KG</span>
                </div>
            </template>
            <button
                type="button"
                class="btn-primary wk-stats-action"
                @click="openAdd"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                Log weight
            </button>
        </div>

        <!-- Chart -->
        <div
            v-if="entries?.length"
            class="card mb-8"
        >
            <div class="card-head mb-4">
                <span class="kicker">Progression</span>
                <div class="toggle">
                    <button
                        v-for="r in RANGES"
                        :key="r.key"
                        type="button"
                        class="toggle-opt"
                        :class="{ on: range === r.key }"
                        @click="range = r.key"
                    >
                        {{ r.label }}
                    </button>
                </div>
            </div>
            <div class="wchart">
                <ClientOnly v-if="points.length">
                    <WeightChart
                        :points="points"
                        :time-unit="timeUnit"
                    />
                    <template #fallback>
                        <div class="wchart-loading" />
                    </template>
                </ClientOnly>
                <div
                    v-else
                    class="wchart-empty"
                >
                    No weigh-ins in this range.
                </div>
            </div>
        </div>

        <!-- Log -->
        <div
            v-if="status === 'pending' && !entries?.length"
            class="empty"
        >
            Loading…
        </div>
        <div
            v-else-if="!entries?.length"
            class="empty"
        >
            No weigh-ins yet. Log your first to start tracking progression.
        </div>
        <div
            v-else
            class="wlog"
        >
            <div
                v-for="row in logRows"
                :key="row.id"
                class="wlog-row"
            >
                <span class="wlog-date">{{
                    fmtDate(parseLocalDay(row.date))
                }}</span>
                <span class="wlog-weight mono">
                    {{ fmt2(row.weight) }}<span class="wlog-unit">kg</span>
                </span>
                <span class="wlog-delta mono">
                    {{ row.delta == null ? '' : signed(row.delta) }}
                </span>
                <div class="wlog-actions">
                    <button
                        type="button"
                        class="icon-btn sm"
                        :aria-label="`Edit ${fmtDate(parseLocalDay(row.date))}`"
                        @click="openEdit(row)"
                    >
                        <Icon
                            name="tabler:pencil"
                            :size="15"
                        />
                    </button>
                    <button
                        type="button"
                        class="icon-btn sm icon-btn--danger"
                        :aria-label="`Delete ${fmtDate(parseLocalDay(row.date))}`"
                        @click="deleteTarget = row"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="15"
                        />
                    </button>
                </div>
            </div>
        </div>

        <!-- Add / edit weigh-in -->
        <UiModal
            v-model:open="formOpen"
            :title="editingId ? 'Edit weigh-in' : 'Log weight'"
            :description="
                editingId ?
                    'Update this weigh-in.'
                :   'Record your bodyweight for a day.'
            "
        >
            <form
                class="space-y-4"
                @submit.prevent="save"
            >
                <div class="field">
                    <label class="field-label">
                        Date <span class="req">*</span>
                    </label>
                    <UiDatePicker
                        v-model="draft.date"
                        :max="todayStr"
                        aria-label="Weigh-in date"
                    />
                </div>
                <div class="field">
                    <label class="field-label">
                        Weight (kg) <span class="req">*</span>
                    </label>
                    <UiNumberField
                        v-model="draft.weight"
                        :min="20"
                        :max="400"
                        :step="0.01"
                    />
                </div>
            </form>

            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="formOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="!canSave || saving"
                    @click="save"
                >
                    <Icon
                        name="tabler:check"
                        :size="16"
                    />
                    {{
                        saving ? 'Saving…'
                        : editingId ? 'Save changes'
                        : 'Log weight'
                    }}
                </button>
            </template>
        </UiModal>

        <!-- Delete weigh-in -->
        <UiModal
            :open="deleteTarget !== null"
            title="Delete weigh-in"
            :description="
                deleteTarget ?
                    `Delete the weigh-in from ${fmtDate(parseLocalDay(deleteTarget.date))}? This can't be undone.`
                :   ''
            "
            @update:open="(open) => !open && (deleteTarget = null)"
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="deleteTarget = null"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="deleting"
                    @click="confirmDelete"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
