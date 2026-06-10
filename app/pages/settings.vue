<script setup lang="ts">
// Account settings only exist in auth mode; self-hosted instances without
// creds bounce home (the auth middleware has filled the state by now).
definePageMeta({
    middleware: () => {
        const authEnabled = useState<boolean | null>('auth-enabled')
        if (authEnabled.value === false) return navigateTo('/')
    },
})

const { user, clear } = useUserSession()
const toast = useToast()

const token = ref<string | null>(null)
const minting = ref(false)

async function generateToken() {
    minting.value = true
    try {
        const res = await $fetch<{ token: string }>('/api/account/token', {
            method: 'POST',
        })
        token.value = res.token
    } catch {
        toast.add({ title: 'Could not generate a token', color: 'error' })
    } finally {
        minting.value = false
    }
}

async function copyToken() {
    if (!token.value) return
    await navigator.clipboard.writeText(token.value)
    toast.add({ title: 'Token copied', color: 'success' })
}

async function copyCommand() {
    await navigator.clipboard.writeText(mcpCommand.value)
    toast.add({ title: 'Command copied', color: 'success' })
}

const scopeItems = [
    { label: 'Local — this project, just you', value: 'local' },
    { label: 'Project — shared via .mcp.json', value: 'project' },
    { label: 'User — all your projects', value: 'user' },
] as const

const scope = ref<'local' | 'project' | 'user'>('local')

const mcpCommand = computed(() => {
    const origin = useRequestURL().origin
    // 'local' is the CLI default, so the flag is only worth spelling out otherwise.
    const scopeFlag = scope.value === 'local' ? '' : `--scope ${scope.value} `
    return `claude mcp add ${scopeFlag}--transport http kilorep ${origin}/mcp --header "Authorization: Bearer ${token.value}"`
})

const confirmOpen = ref(false)
const deleting = ref(false)

async function deleteAccount() {
    deleting.value = true
    try {
        await $fetch('/api/account', { method: 'DELETE' })
        await clear()
        await navigateTo('/login')
    } catch {
        toast.add({ title: 'Could not delete the account', color: 'error' })
        deleting.value = false
    }
}

async function signOut() {
    await clear()
    await navigateTo('/login')
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
        </div>

        <div class="card">
            <div class="card-head mb-4">
                <span class="kicker kicker--accent">MCP access</span>
                <button
                    type="button"
                    class="btn-ghost sm"
                    :disabled="minting"
                    @click="generateToken"
                >
                    <Icon
                        name="tabler:key"
                        :size="15"
                    />
                    {{ token ? 'Regenerate' : 'Generate token' }}
                </button>
            </div>
            <p class="settings-hint">
                This token lets Claude Code log workouts and weigh-ins via the
                <span class="mono">/mcp</span> endpoint. Generating a new token
                replaces the old one.
            </p>
            <template v-if="token">
                <div class="token-row">
                    <code class="token mono">{{ token }}</code>
                    <button
                        type="button"
                        class="icon-btn copy-btn"
                        aria-label="Copy token"
                        @click="copyToken"
                    >
                        <Icon
                            name="tabler:copy"
                            :size="15"
                        />
                    </button>
                </div>
                <p class="settings-hint">
                    Copy it now — it won't be shown again. Then register the
                    server:
                </p>
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
                        @click="copyCommand"
                    >
                        <Icon
                            name="tabler:copy"
                            :size="15"
                        />
                    </button>
                </div>
            </template>
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
