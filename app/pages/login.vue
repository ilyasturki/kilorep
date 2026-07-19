<script setup lang="ts">
definePageMeta({ bare: true })

const route = useRoute()
const failed = computed(() => route.query.error != null)
const { appVersion } = useRuntimeConfig().public

// Belt-and-braces alongside the sign-out wipe: whoever signs in next must
// not inherit the previous account's cached data.
onMounted(clearUserCaches)

useHead({ title: 'Sign in · Kilorep' })
</script>

<template>
    <div class="grid min-h-dvh place-items-center bg-canvas p-6 text-ink">
        <div
            class="flex w-[min(380px,100%)] flex-col items-center gap-4.5 border border-line-2 bg-surface px-8 py-11 text-center"
        >
            <span class="flex items-center gap-3">
                <UiLogo class="size-[34px]" />
                <span class="text-[26px] font-extrabold tracking-[-0.03em]">
                    Kilorep
                </span>
            </span>
            <p class="text-body text-balance text-ink-2">
                Minimalist strength training — sessions, supersets and weight
                tracking.
            </p>
            <UiButton
                as-child
                size="lg"
                class="mt-2"
            >
                <a href="/auth/google">
                    <Icon
                        name="tabler:brand-google-filled"
                        :size="18"
                    />
                    Continue with Google
                </a>
            </UiButton>
            <p
                v-if="failed"
                class="text-body-sm text-[#f87171]"
            >
                Sign-in failed — please try again.
            </p>
        </div>
        <p
            class="fixed right-0 bottom-[calc(10px+env(safe-area-inset-bottom))] left-0 text-center text-micro text-ink-3 opacity-55"
        >
            v{{ appVersion }}
        </p>
    </div>
</template>
