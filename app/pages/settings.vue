<script setup lang="ts">
import { SUPPORTED_LOCALES } from '~~/shared/locales'
import { appLocale } from '~/utils/appLocale'

// Account settings only exist in auth mode; self-hosted instances without
// creds bounce home (the auth middleware has filled the state by now).
definePageMeta({
    middleware: () => {
        if (useAuthEnabled().value === false) return navigateTo('/')
    },
})

const { user } = useUserSession()
const toast = useToast()
const signOut = useSignOut()
const { appVersion } = useRuntimeConfig().public

// Mutations below patch `tokens` from their own responses instead of
// refetching: the list stays correct even when the service worker would
// answer a refetch from its pre-mutation cache.
const { data: tokens, error: tokensError } = await useFetch(
    '/api/account/tokens',
)

// ── Number & date format ────────────────────────────────────────────────────
// 'auto' is the UI stand-in for a null pin (follow the device); UiSelect only
// takes string|number values.
const AUTO = 'auto'
const localeItems = [
    { label: 'Automatic (device)', value: AUTO },
    ...SUPPORTED_LOCALES,
]
const { data: prefs } = await useFetch('/api/account/preferences')
const localeChoice = ref<string>(prefs.value?.locale ?? AUTO)

// Preview the chosen format through the same formatters the app uses, so the
// two can't drift; the override shows the choice before it's saved/applied.
const samplePreview = computed(() => {
    const loc =
        localeChoice.value === AUTO ? navigator.language : localeChoice.value
    return `${fmtFixed2(82.5, loc)} kg · ${fmtDate(new Date(), loc)}`
})

async function saveLocale(value: string | undefined) {
    if (value == null) return
    const prev = localeChoice.value
    localeChoice.value = value
    const locale = value === AUTO ? null : value
    try {
        await $fetch('/api/account/preferences', {
            method: 'PATCH',
            body: { locale },
        })
        // Apply everywhere instantly; null falls back to the device.
        appLocale.value = locale ?? navigator.language
        toast.add({ title: 'Format updated', color: 'success' })
    } catch (error) {
        localeChoice.value = prev
        toast.add({
            title: errorMessage(error, 'Could not update the format'),
            color: 'error',
        })
    }
}

function lastUsed(value: string | Date | null): string {
    if (!value) return 'never used'
    const date = new Date(value)
    // floor, not round — 23h59m must stay in the hours branch, not "24h ago".
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
    if (minutes < 1) return 'used just now'
    if (minutes < 60) return `used ${minutes}m ago`
    if (minutes < 24 * 60) return `used ${Math.floor(minutes / 60)}h ago`
    return `used ${fmtDate(date)}`
}

// ── Creation modal ──────────────────────────────────────────────────────────
// Two phases: name the token, then the one-time reveal. The cleartext lives
// only in `minted`; closing the modal discards it for good (the server keeps
// just a hash).
const createOpen = ref(false)
const newLabel = ref('')
const minting = ref(false)
const minted = ref<string | null>(null)

watch(createOpen, (open) => {
    if (!open) {
        minted.value = null
        newLabel.value = ''
    }
})

async function createToken() {
    if (minting.value) return
    minting.value = true
    try {
        const res = await $fetch('/api/account/tokens', {
            method: 'POST',
            // The date fallback is minted here rather than on the server so
            // it lands in the user's timezone and locale.
            body: {
                label:
                    newLabel.value.trim() || `Token · ${fmtDate(new Date())}`,
            },
        })
        // The modal may have been closed while the POST was in flight; a
        // token nobody ever saw is revoked, not revealed on the next open.
        if (!createOpen.value) {
            $fetch(`/api/account/tokens/${res.record.id}`, {
                method: 'DELETE',
            }).catch(() => {})
            return
        }
        minted.value = res.token
        tokens.value = [...(tokens.value ?? []), res.record]
    } catch (error) {
        toast.add({
            title: errorMessage(error, 'Could not create the token'),
            color: 'error',
        })
    } finally {
        minting.value = false
    }
}

async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `${label} copied`, color: 'success' })
}

const scopeItems = [
    { label: 'Local — this project, just you', value: 'local' },
    { label: 'Project — shared via .mcp.json', value: 'project' },
    { label: 'User — all your projects', value: 'user' },
] as const

const scope = ref<'local' | 'project' | 'user'>('local')

const origin = useRequestURL().origin

const mcpCommand = computed(() => {
    // 'local' is the CLI default, so the flag is only worth spelling out otherwise.
    const scopeFlag = scope.value === 'local' ? '' : `--scope ${scope.value} `
    return `claude mcp add ${scopeFlag}--transport http kilorep ${origin}/mcp --header "Authorization: Bearer ${minted.value}"`
})

const mcpJson = computed(() =>
    JSON.stringify(
        {
            mcpServers: {
                kilorep: {
                    type: 'http',
                    url: `${origin}/mcp`,
                    headers: {
                        Authorization: `Bearer ${minted.value}`,
                    },
                },
            },
        },
        null,
        2,
    ),
)

// ── Inline rename ───────────────────────────────────────────────────────────
const editingId = ref<number | null>(null)
const editLabel = ref('')

const vSelect = {
    // A bare select() at mount silently loses to the click that opened the
    // editor; deferring a frame lets focus settle first.
    mounted: (el: HTMLInputElement) =>
        requestAnimationFrame(() => {
            el.focus()
            el.select()
        }),
}

function startRename(id: number, label: string) {
    editingId.value = id
    editLabel.value = label
}

async function saveRename() {
    const id = editingId.value
    if (id == null) return
    editingId.value = null
    const label = editLabel.value.trim()
    // An emptied field reads as a change of heart, not a request for a blank label.
    if (!label || label === tokens.value?.find((t) => t.id === id)?.label)
        return
    try {
        const record = await $fetch(`/api/account/tokens/${id}`, {
            method: 'PATCH',
            body: { label },
        })
        if (tokens.value)
            tokens.value = tokens.value.map((t) => (t.id === id ? record : t))
    } catch (error) {
        toast.add({
            title: errorMessage(error, 'Could not rename the token'),
            color: 'error',
        })
    }
}

// ── Two-step delete ─────────────────────────────────────────────────────────
const confirmingId = ref<number | null>(null)
let confirmTimer: ReturnType<typeof setTimeout> | undefined

function askDelete(id: number) {
    confirmingId.value = id
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
        confirmingId.value = null
    }, 3000)
}

async function removeToken(id: number) {
    clearTimeout(confirmTimer)
    confirmingId.value = null
    try {
        await $fetch(`/api/account/tokens/${id}`, { method: 'DELETE' })
        if (tokens.value) tokens.value = tokens.value.filter((t) => t.id !== id)
    } catch (error) {
        toast.add({
            title: errorMessage(error, 'Could not delete the token'),
            color: 'error',
        })
    }
}

const revoking = ref(false)

async function revokeSessions() {
    revoking.value = true
    try {
        await $fetch('/api/account/sessions', { method: 'DELETE' })
        toast.add({ title: 'Other browsers signed out', color: 'success' })
    } catch (error) {
        toast.add({
            title: errorMessage(error, 'Could not sign out the other browsers'),
            color: 'error',
        })
    } finally {
        revoking.value = false
    }
}

const confirmOpen = ref(false)
const deleting = ref(false)

async function deleteAccount() {
    deleting.value = true
    try {
        await $fetch('/api/account', { method: 'DELETE' })
        await signOut()
    } catch (error) {
        toast.add({
            title: errorMessage(error, 'Could not delete the account'),
            color: 'error',
        })
        deleting.value = false
    }
}
</script>

<template>
    <div class="space-y-4">
        <div class="card">
            <div class="card-head mb-4">
                <span class="kicker kicker--accent">Account</span>
                <button
                    type="button"
                    class="btn-ghost sm"
                    @click="signOut"
                >
                    <Icon
                        name="tabler:logout"
                        :size="15"
                    />
                    Sign out
                </button>
            </div>
            <div class="acct">
                <img
                    v-if="user?.avatarUrl"
                    :src="user.avatarUrl"
                    class="acct-avatar"
                    alt=""
                    referrerpolicy="no-referrer"
                />
                <div class="acct-id">
                    <strong>{{ user?.name ?? '—' }}</strong>
                    <span class="acct-email">{{ user?.email }}</span>
                </div>
            </div>
            <p class="settings-hint mt-3">
                Left yourself signed in somewhere? This ends every other browser
                session and keeps this one. Devices signed in with a token are
                listed under MCP access, and stay connected.
            </p>
            <button
                type="button"
                class="btn-ghost sm mt-2"
                :disabled="revoking"
                @click="revokeSessions"
            >
                <Icon
                    name="tabler:devices-off"
                    :size="15"
                />
                Sign out other browsers
            </button>
        </div>

        <div class="card">
            <div class="card-head mb-4">
                <span class="kicker kicker--accent"
                    >Number &amp; date format</span
                >
            </div>
            <p class="settings-hint">
                How weights, volumes and dates are written. "Automatic" follows
                this device; pick a region to keep it the same on every browser.
            </p>
            <UiSelect
                :model-value="localeChoice"
                :items="localeItems"
                @update:model-value="saveLocale"
            />
            <p class="settings-hint mt-2">
                Preview: <span class="mono">{{ samplePreview }}</span>
            </p>
        </div>

        <div class="card">
            <div class="card-head mb-4">
                <span class="kicker kicker--accent">MCP access</span>
                <button
                    type="button"
                    class="btn-ghost sm"
                    @click="createOpen = true"
                >
                    <Icon
                        name="tabler:key"
                        :size="15"
                    />
                    New token
                </button>
            </div>
            <p class="settings-hint">
                Tokens let MCP clients like Claude Code log workouts and
                weigh-ins via the <span class="mono">/mcp</span> endpoint. Each
                token is shown in full exactly once, at creation.
            </p>
            <ul
                v-if="tokens?.length"
                class="token-list"
            >
                <li
                    v-for="t in tokens"
                    :key="t.id"
                    class="token-item"
                >
                    <template v-if="editingId === t.id">
                        <input
                            v-select
                            v-model="editLabel"
                            class="input sm"
                            maxlength="60"
                            @keydown.enter="saveRename"
                            @keydown.esc="editingId = null"
                        />
                        <div class="token-actions">
                            <button
                                type="button"
                                class="icon-btn sm"
                                aria-label="Save name"
                                @click="saveRename"
                            >
                                <Icon
                                    name="tabler:check"
                                    :size="15"
                                />
                            </button>
                            <button
                                type="button"
                                class="icon-btn sm"
                                aria-label="Cancel rename"
                                @click="editingId = null"
                            >
                                <Icon
                                    name="tabler:x"
                                    :size="15"
                                />
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <div class="token-info">
                            <span class="token-label">{{ t.label }}</span>
                            <span class="token-meta mono">
                                {{ t.tokenPrefix }}… ·
                                {{ fmtDate(t.createdAt) }} ·
                                {{ lastUsed(t.lastUsedAt) }}
                            </span>
                        </div>
                        <div class="token-actions">
                            <button
                                type="button"
                                class="icon-btn sm"
                                aria-label="Rename token"
                                @click="startRename(t.id, t.label)"
                            >
                                <Icon
                                    name="tabler:pencil"
                                    :size="15"
                                />
                            </button>
                            <button
                                v-if="confirmingId === t.id"
                                type="button"
                                class="btn-danger sm"
                                @click="removeToken(t.id)"
                            >
                                Confirm?
                            </button>
                            <button
                                v-else
                                type="button"
                                class="icon-btn sm icon-btn--danger"
                                aria-label="Delete token"
                                @click="askDelete(t.id)"
                            >
                                <Icon
                                    name="tabler:trash"
                                    :size="15"
                                />
                            </button>
                        </div>
                    </template>
                </li>
            </ul>
            <p
                v-else-if="tokensError"
                class="settings-hint mt-3"
            >
                Couldn't load your tokens — reload the page to retry.
            </p>
            <p
                v-else
                class="settings-hint mt-3"
            >
                No tokens yet — create one to connect a client.
            </p>
        </div>

        <div class="card">
            <div class="card-head mb-4">
                <span class="kicker">Danger zone</span>
                <button
                    type="button"
                    class="btn-danger"
                    @click="confirmOpen = true"
                >
                    Delete account
                </button>
            </div>
            <p class="settings-hint">
                Permanently deletes your account with every workout, session,
                exercise and weigh-in. There is no undo.
            </p>
        </div>

        <p class="app-version">Kilorep v{{ appVersion }}</p>

        <UiModal
            v-model:open="createOpen"
            :title="minted ? 'Token created' : 'New MCP token'"
            :description="
                minted ?
                    'Copy it now — it won’t be shown again.'
                :   'An optional name to tell your tokens apart.'
            "
        >
            <template v-if="!minted">
                <input
                    v-model="newLabel"
                    class="input"
                    placeholder="e.g. laptop, phone…"
                    maxlength="60"
                    @keydown.enter="createToken"
                />
            </template>
            <template v-else>
                <div class="token-row">
                    <code class="token mono">{{ minted }}</code>
                    <button
                        type="button"
                        class="icon-btn copy-btn"
                        aria-label="Copy token"
                        @click="copy(minted, 'Token')"
                    >
                        <Icon
                            name="tabler:copy"
                            :size="15"
                        />
                    </button>
                </div>
                <p class="settings-hint">Claude Code — pick a scope and run:</p>
                <div class="scope-row">
                    <span class="scope-label">Scope</span>
                    <UiSelect
                        v-model="scope"
                        :items="scopeItems"
                    />
                </div>
                <div class="cmd-row">
                    <code class="token-cmd mono">{{ mcpCommand }}</code>
                    <button
                        type="button"
                        class="icon-btn copy-btn"
                        aria-label="Copy command"
                        @click="copy(mcpCommand, 'Command')"
                    >
                        <Icon
                            name="tabler:copy"
                            :size="15"
                        />
                    </button>
                </div>
                <p class="settings-hint">
                    Any other MCP client — drop this into its config:
                </p>
                <div class="cmd-row">
                    <code class="token-cmd token-json mono">{{ mcpJson }}</code>
                    <button
                        type="button"
                        class="icon-btn copy-btn"
                        aria-label="Copy JSON config"
                        @click="copy(mcpJson, 'Config')"
                    >
                        <Icon
                            name="tabler:copy"
                            :size="15"
                        />
                    </button>
                </div>
            </template>
            <template #footer>
                <template v-if="!minted">
                    <button
                        type="button"
                        class="btn-ghost"
                        @click="createOpen = false"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="btn-primary"
                        :disabled="minting"
                        @click="createToken"
                    >
                        Create
                    </button>
                </template>
                <button
                    v-else
                    type="button"
                    class="btn-primary"
                    @click="createOpen = false"
                >
                    Done
                </button>
            </template>
        </UiModal>

        <UiModal
            v-model:open="confirmOpen"
            title="Delete account?"
            description="Everything you logged is permanently removed. This cannot be undone."
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="confirmOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="deleting"
                    @click="deleteAccount"
                >
                    Delete everything
                </button>
            </template>
        </UiModal>
    </div>
</template>
