<script setup lang="ts">
import {
    Activity,
    Dumbbell,
    ListChecks,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-vue-next'

const route = useRoute()

const collapsed = useCookie<boolean>('sidebar-collapsed', {
    default: () => false,
})

const links = [
    { label: 'Workouts', to: '/workouts', icon: Activity },
    { label: 'Sessions', to: '/sessions', icon: ListChecks },
    { label: 'Exercises', to: '/exercises', icon: Dumbbell },
]

const APP_NAME = 'Kilorep'

const section = computed(
    () => links.find((link) => route.path.startsWith(link.to))?.label,
)
const title = computed(() => section.value ?? APP_NAME)

useHead({
    title: () => (section.value ? `${section.value} · ${APP_NAME}` : APP_NAME),
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
                    <component
                        :is="collapsed ? PanelLeftOpen : PanelLeftClose"
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
                    <component
                        :is="link.icon"
                        :size="20"
                    />
                    <span>{{ link.label }}</span>
                </NuxtLink>
            </nav>
        </aside>

        <div class="main">
            <header class="topbar">
                <div class="topbar-l">
                    <h1 class="topbar-title">{{ title }}</h1>
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
                <component
                    :is="link.icon"
                    :size="22"
                />
                <span class="tab-label">{{ link.label }}</span>
            </NuxtLink>
        </nav>

        <UiToaster />
    </div>
</template>
