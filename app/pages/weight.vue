<script setup lang="ts">
import type { Bodyweight } from '~~/server/database/schema'
import { bodyweightInputSchema } from '~~/shared/validation/bodyweight'

const {
    data: entries,
    status,
    refresh,
} = await useFetch<Bodyweight[]>(PAYLOAD.bodyweight, {
    key: PAYLOAD.bodyweight,
    server: false,
    lazy: true,
    default: () => [],
    getCachedData: cachedPayload,
})
revalidate({ status, refresh })
const loading = initialLoading({ status })
const invalidate = usePayloadCache()

const toast = useToast()

const toMs = (d: string) => parseLocalDay(d).getTime()

const todayStr = toDateInput(new Date())

const RANGES = [
    { key: '1W', label: '1W' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '1Y', label: '1Y' },
    { key: 'all', label: 'All' },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const range = useLocalStorage<RangeKey>('weight-progression-range', 'all')
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

// The same schema the API validates against, so the button can't enable a
// payload the server would reject. The extra date check is deliberately
// stricter than the schema's: the server allows a day of slack for clients in
// a timezone ahead of it, but there is no reason to offer a future weigh-in
// against this device's own calendar.
const canSave = computed(() => {
    const { date, weight } = draft.value
    return (
        date <= todayStr
        && bodyweightInputSchema.safeParse({ date, weight }).success
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
        // The dashboard shows current weight and its 30-day change.
        invalidate(PAYLOAD.dashboard)
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
        invalidate(PAYLOAD.dashboard)
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
                    <span class="stat-num mono text-[22px]">
                        {{ latest ? fmtFixed2(latest.weight) : '—' }}
                    </span>
                    <span class="stat-lab">CURRENT · KG</span>
                </div>
                <div class="wk-stat">
                    <span class="stat-num mono text-[22px]">
                        {{
                            rangeChange == null ? '—' : fmtSigned2(rangeChange)
                        }}
                    </span>
                    <span class="stat-lab">CHANGE · {{ rangeLabel }}</span>
                </div>
                <div
                    v-if="minMax"
                    class="wk-stat"
                >
                    <span class="stat-num mono text-[22px]">{{
                        fmtFixed2(minMax.min)
                    }}</span>
                    <span class="stat-lab">LOWEST · KG</span>
                </div>
                <div
                    v-if="minMax"
                    class="wk-stat"
                >
                    <span class="stat-num mono text-[22px]">{{
                        fmtFixed2(minMax.max)
                    }}</span>
                    <span class="stat-lab">HIGHEST · KG</span>
                </div>
            </template>
            <UiButton
                type="button"
                class="wk-stats-action"
                @click="openAdd"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                Log weight
            </UiButton>
        </div>

        <!-- Chart -->
        <UiCard
            v-if="entries?.length"
            class="mb-8"
        >
            <UiCardHead class="mb-4">
                <span class="kicker">Progression</span>
                <UiSegmented stretch>
                    <UiSegmentedOption
                        v-for="r in RANGES"
                        :key="r.key"
                        type="button"
                        :active="range === r.key"
                        @click="range = r.key"
                    >
                        {{ r.label }}
                    </UiSegmentedOption>
                </UiSegmented>
            </UiCardHead>
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
        </UiCard>

        <!-- Log -->
        <UiEmpty v-if="loading"> Loading… </UiEmpty>
        <UiEmpty v-else-if="!entries?.length">
            No weigh-ins yet. Log your first to start tracking progression.
        </UiEmpty>
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
                    {{ fmtFixed2(row.weight) }}<span class="wlog-unit">kg</span>
                </span>
                <span class="wlog-delta mono">
                    {{ row.delta == null ? '' : fmtSigned2(row.delta) }}
                </span>
                <div class="wlog-actions">
                    <UiIconButton
                        type="button"
                        size="sm"
                        :aria-label="`Edit ${fmtDate(parseLocalDay(row.date))}`"
                        @click="openEdit(row)"
                    >
                        <Icon
                            name="tabler:pencil"
                            :size="15"
                        />
                    </UiIconButton>
                    <UiIconButton
                        type="button"
                        size="sm"
                        tone="danger"
                        :aria-label="`Delete ${fmtDate(parseLocalDay(row.date))}`"
                        @click="deleteTarget = row"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="15"
                        />
                    </UiIconButton>
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
                <UiField>
                    <UiFieldLabel>
                        Date <span class="text-accent-ink">*</span>
                    </UiFieldLabel>
                    <UiDatePicker
                        v-model="draft.date"
                        :max="todayStr"
                        aria-label="Weigh-in date"
                    />
                </UiField>
                <UiField>
                    <UiFieldLabel>
                        Weight (kg) <span class="text-accent-ink">*</span>
                    </UiFieldLabel>
                    <UiNumberField
                        v-model="draft.weight"
                        :min="20"
                        :max="400"
                        :step="0.01"
                    />
                </UiField>
            </form>

            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="formOpen = false"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
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
                </UiButton>
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
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="deleteTarget = null"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    tone="danger"
                    :disabled="deleting"
                    @click="confirmDelete"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>
