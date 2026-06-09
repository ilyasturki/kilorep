<script setup lang="ts">
const route = useRoute()
const header = usePageHeader()

const collapsed = useCookie<boolean>('sidebar-collapsed', {
    default: () => false,
})

const links = [
    { label: 'Workouts', to: '/workouts', icon: 'tabler:activity' },
    { label: 'Sessions', to: '/sessions', icon: 'tabler:list-check' },
    { label: 'Exercises', to: '/exercises', icon: 'tabler:dumbbell' },
    { label: 'Weight', to: '/weight', icon: 'tabler:scale' },
]

const APP_NAME = 'Kilorep'

const section = computed(
    () => links.find((link) => route.path.startsWith(link.to))?.label,
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
    <div class="shell">
        <aside
            class="sidebar"
            :class="{ collapsed }"
        >
            <div class="brand">
                <span class="brand-mark">
                    <UiLogo class="brand-logo" />
                    <span class="brand-name">{{ APP_NAME }}</span>
                </span>
                <button
                    type="button"
                    class="side-toggle"
                    :aria-label="
                        collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                    "
                    :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
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

            <nav class="nav">
                <NuxtLink
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    class="nav-item"
                    :class="{ on: route.path.startsWith(link.to) }"
                    :title="collapsed ? link.label : undefined"
                >
                    <Icon
                        :name="link.icon"
                        :size="20"
                    />
                    <span>{{ link.label }}</span>
                </NuxtLink>
            </nav>
        </aside>

        <div class="main">
            <header class="topbar">
                <div class="topbar-l">
                    <div
                        v-if="header"
                        class="topbar-head"
                    >
                        <NuxtLink
                            v-if="header.back"
                            :to="header.back"
                            class="topbar-back"
                            aria-label="Back"
                        >
                            <Icon
                                name="tabler:chevron-left"
                                :size="22"
                            />
                        </NuxtLink>
                        <h1 class="topbar-title">{{ header.title }}</h1>
                        <span
                            v-if="header.tag"
                            class="tag"
                            :class="{ 'tag--accent': header.tag.accent }"
                        >
                            {{ header.tag.label }}
                        </span>
                    </div>
                    <h1
                        v-else
                        class="topbar-title"
                    >
                        {{ title }}
                    </h1>
                </div>
            </header>

            <main class="main-scroll">
                <div class="page">
                    <NuxtPage />
                </div>
            </main>
        </div>

        <nav class="tabbar">
            <NuxtLink
                v-for="link in links"
                :key="link.to"
                :to="link.to"
                class="tab"
                :class="{ 'is-active': route.path.startsWith(link.to) }"
            >
                <Icon
                    :name="link.icon"
                    :size="22"
                />
                <span class="tab-label">{{ link.label }}</span>
            </NuxtLink>
        </nav>

        <UiToaster />
    </div>
</template>
