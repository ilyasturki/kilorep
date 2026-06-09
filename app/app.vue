<script setup lang="ts">
import { Dumbbell, ListChecks, Moon, Sun } from 'lucide-vue-next'

const route = useRoute()
const { isDark, set, toggle } = useTheme()

const links = [
    { label: 'Exercises', to: '/exercises', icon: Dumbbell },
    { label: 'Sessions', to: '/sessions', icon: ListChecks },
]

const title = computed(
    () =>
        links.find((link) => route.path.startsWith(link.to))?.label
        ?? 'Workout Manager',
)
</script>

<template>
    <div class="shell">
        <aside class="sidebar">
            <div class="brand">
                <span class="brand-dot" />
                <span class="brand-name">Workout</span>
            </div>

            <nav class="nav">
                <NuxtLink
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    class="nav-item"
                    :class="{ on: route.path.startsWith(link.to) }"
                >
                    <component
                        :is="link.icon"
                        :size="20"
                    />
                    <span>{{ link.label }}</span>
                </NuxtLink>
            </nav>

            <div class="side-foot">
                <div>
                    <div class="kicker">Workout Manager</div>
                    <div class="side-split mono">GYM · WEIGHT TRACKER</div>
                </div>
                <div class="seg">
                    <span
                        class="seg-opt"
                        :class="{ on: isDark }"
                        role="button"
                        @click="set('dark')"
                    >
                        Dark
                    </span>
                    <span
                        class="seg-opt"
                        :class="{ on: !isDark }"
                        role="button"
                        @click="set('light')"
                    >
                        Light
                    </span>
                </div>
            </div>
        </aside>

        <div class="main">
            <header class="topbar">
                <div class="topbar-l">
                    <span class="kicker">Workout Manager</span>
                    <h1 class="topbar-title">{{ title }}</h1>
                </div>
                <button
                    type="button"
                    class="icon-btn theme-toggle-mobile"
                    aria-label="Toggle theme"
                    @click="toggle"
                >
                    <Moon
                        v-if="isDark"
                        :size="18"
                    />
                    <Sun
                        v-else
                        :size="18"
                    />
                </button>
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
