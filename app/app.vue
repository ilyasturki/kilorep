<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'

import { appLocale } from '~/utils/appLocale'

const route = useRoute()
const header = usePageHeader()

const { loggedIn, user } = useUserSession()

const online = useOnline()

// Pages flagged bare via definePageMeta (login) stand outside the app shell.
const bare = computed(() => route.meta.bare === true)

// Prefetch the list endpoints once the shell is up, so the first visit to each
// page renders from cache instead of an empty state.
warmPayloadCache(() => !bare.value)

const signOut = useSignOut()

const collapsed = useCookie<boolean>('sidebar-collapsed', {
    default: () => false,
})

// Settings only exists for signed-in accounts (token, deletion); a
// self-hosted instance without auth has nothing to put there.
const links = computed(() => [
    {
        label: 'Dashboard',
        to: '/dashboard',
        icon: 'tabler:layout-dashboard',
    },
    { label: 'Workouts', to: '/workouts', icon: 'tabler:activity' },
    { label: 'Sessions', to: '/sessions', icon: 'tabler:list-check' },
    { label: 'Exercises', to: '/exercises', icon: 'tabler:dumbbell' },
    { label: 'Weight', to: '/weight', icon: 'tabler:scale' },
    ...(loggedIn.value ?
        [{ label: 'Settings', to: '/settings', icon: 'tabler:settings' }]
    :   []),
])

const APP_NAME = 'Kilorep'

// The logo is the dashboard entry point (sidebar on desktop, topbar on mobile),
// so the bottom tab bar drops the redundant Dashboard tab — which also eases the
// five-tab crowding on narrow viewports.
const tabLinks = computed(() =>
    links.value.filter((link) => link.to !== '/dashboard'),
)

const section = computed(
    () => links.value.find((link) => route.path.startsWith(link.to))?.label,
)
const title = computed(() => section.value ?? APP_NAME)

useHead({
    title: () => {
        const name = header.value?.title ?? section.value
        return name ? `${name} · ${APP_NAME}` : APP_NAME
    },
})
</script>

<template>
    <ConfigProvider :locale="appLocale">
        <div v-if="bare">
            <NuxtPage />
            <UiToaster />
        </div>
        <div
            v-else
            class="flex min-h-dvh flex-col bg-canvas text-ink xl:h-dvh xl:flex-row xl:overflow-hidden"
        >
            <!-- `data-collapsed` drives both this element's own width and the
                 descendants that reshape with it, via group-data variants. -->
            <aside
                class="group/side hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:w-62 xl:flex-none xl:flex-col xl:border-r xl:border-r-line xl:px-5.5 xl:py-7.5 xl:transition-[width] xl:duration-[180ms] xl:data-collapsed:w-19 xl:data-collapsed:px-3.5"
                :data-collapsed="collapsed || undefined"
            >
                <div
                    class="flex items-center justify-between gap-[11px] xl:px-1.5 xl:pb-9 xl:group-data-collapsed/side:flex-col xl:group-data-collapsed/side:gap-4.5 xl:group-data-collapsed/side:px-0"
                >
                    <NuxtLink
                        to="/dashboard"
                        class="flex min-w-0 items-center gap-[11px] text-ink"
                        aria-label="Dashboard"
                    >
                        <UiLogo class="size-[22px] flex-none text-accent-ink" />
                        <span
                            class="text-[18px] font-black tracking-[0.02em] uppercase xl:group-data-collapsed/side:hidden"
                        >
                            {{ APP_NAME }}
                        </span>
                    </NuxtLink>
                    <button
                        type="button"
                        class="flex size-8 flex-none items-center justify-center border border-line-2 bg-transparent text-ink-3 transition-[color,background] duration-[120ms] hover:bg-surface-2 hover:text-ink"
                        :aria-label="
                            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                        "
                        :title="
                            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                        "
                        :aria-expanded="!collapsed"
                        @click="collapsed = !collapsed"
                    >
                        <Icon
                            :name="
                                collapsed ?
                                    'tabler:layout-sidebar-left-expand'
                                :   'tabler:layout-sidebar-left-collapse'
                            "
                            :size="18"
                        />
                    </button>
                </div>

                <div class="mb-4">
                    <WorkoutStartButton
                        variant="sidebar"
                        :collapsed="collapsed"
                    />
                </div>

                <nav class="flex flex-col gap-[3px]">
                    <NuxtLink
                        v-for="link in links"
                        :key="link.to"
                        :to="link.to"
                        class="flex items-center gap-[13px] border-0 border-l-2 px-3.5 py-3.25 text-body-lg font-semibold transition-[color] duration-[120ms] xl:group-data-collapsed/side:justify-center xl:group-data-collapsed/side:px-0"
                        :class="
                            route.path.startsWith(link.to) ?
                                'border-l-accent bg-surface text-ink'
                            :   'border-l-transparent bg-transparent text-ink-3 hover:text-ink-2'
                        "
                        :title="collapsed ? link.label : undefined"
                    >
                        <Icon
                            :name="link.icon"
                            :size="20"
                        />
                        <span class="xl:group-data-collapsed/side:hidden">
                            {{ link.label }}
                        </span>
                    </NuxtLink>
                </nav>

                <div
                    v-if="loggedIn"
                    class="mt-auto flex min-w-0 items-center gap-2.5 border-t border-t-line px-1.5 pt-3.5 group-data-collapsed/side:flex-col group-data-collapsed/side:gap-2.5 group-data-collapsed/side:px-0"
                >
                    <NuxtLink
                        to="/settings"
                        class="group/account flex min-w-0 flex-1 items-center gap-2.5"
                    >
                        <Icon
                            name="tabler:user"
                            :size="18"
                            class="flex-none text-ink-2 group-hover/account:text-ink"
                        />
                        <span
                            class="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink-2 group-hover/account:text-ink group-data-collapsed/side:hidden"
                        >
                            {{ user?.name ?? user?.email }}
                        </span>
                    </NuxtLink>
                    <button
                        type="button"
                        class="grid place-items-center border-none bg-transparent p-1.5 text-ink-3 transition-[color] duration-[120ms] hover:text-ink"
                        title="Sign out"
                        aria-label="Sign out"
                        @click="signOut"
                    >
                        <Icon
                            name="tabler:logout"
                            :size="18"
                        />
                    </button>
                </div>
            </aside>

            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                    v-if="!online"
                    class="border-b border-b-line bg-surface-2 px-4.5 py-1.5 text-center text-label font-semibold tracking-[0.04em] text-ink-2 uppercase"
                >
                    Offline — showing cached data
                </div>
                <header
                    class="flex items-end justify-between gap-4 border-b border-b-line px-5.5 pt-5.5 pb-4.5 xl:px-10 xl:pt-8 xl:pb-6"
                >
                    <div class="flex min-w-0 flex-col gap-[7px]">
                        <div
                            v-if="header"
                            class="flex min-w-0 items-center gap-3"
                        >
                            <NuxtLink
                                v-if="header.back"
                                :to="header.back"
                                class="-ml-1.5 inline-flex items-center justify-center text-ink-2 transition-[color] duration-[120ms] hover:text-accent-ink"
                                aria-label="Back"
                            >
                                <Icon
                                    name="tabler:chevron-left"
                                    :size="22"
                                />
                            </NuxtLink>
                            <h1
                                class="text-[30px] font-extrabold tracking-[-0.03em] capitalize xl:text-[36px]"
                            >
                                {{ header.title }}
                            </h1>
                            <UiTag
                                v-if="header.tag"
                                :accent="header.tag.accent"
                            >
                                {{ header.tag.label }}
                            </UiTag>
                        </div>
                        <h1
                            v-else
                            class="text-[30px] font-extrabold tracking-[-0.03em] xl:text-[36px]"
                        >
                            {{ title }}
                        </h1>
                    </div>
                    <NuxtLink
                        to="/dashboard"
                        class="-my-1.5 -mr-1.5 inline-flex flex-none items-center justify-center self-center p-1.5 text-accent-ink xl:hidden"
                        aria-label="Dashboard"
                    >
                        <UiLogo class="size-[22px] flex-none" />
                    </NuxtLink>
                </header>

                <main
                    class="flex-1 px-5.5 pb-24 xl:min-h-0 xl:overflow-y-auto xl:px-10 xl:pb-12"
                >
                    <div class="mx-auto w-full max-w-[1080px] pt-5.5 xl:pt-8">
                        <NuxtPage />
                    </div>
                </main>
            </div>

            <nav
                class="fixed right-0 bottom-0 left-0 z-30 grid grid-flow-col [grid-auto-columns:minmax(0,1fr)] border-t border-t-line bg-canvas-veil px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-[12px] xl:hidden"
            >
                <NuxtLink
                    v-for="link in tabLinks"
                    :key="link.to"
                    :to="link.to"
                    class="flex flex-col items-center gap-[5px] pt-2 pb-1"
                    :class="
                        route.path.startsWith(link.to) ?
                            'text-ink'
                        :   'text-ink-3'
                    "
                >
                    <Icon
                        :name="link.icon"
                        :size="22"
                    />
                    <span
                        class="max-w-full truncate text-[10.5px] font-semibold tracking-[0.02em] uppercase"
                    >
                        {{ link.label }}
                    </span>
                </NuxtLink>
            </nav>

            <UiToaster />
        </div>
    </ConfigProvider>
</template>
