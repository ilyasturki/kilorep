<script setup lang="ts">
const route = useRoute()
const failed = computed(() => route.query.error != null)

useHead({ title: 'Sign in · Kilorep' })
</script>

<template>
    <div class="login-screen">
        <div class="login-card">
            <span class="login-brand">
                <UiLogo class="login-logo" />
                <span class="login-name">Kilorep</span>
            </span>
            <p class="login-tag">
                Minimalist strength training — sessions, supersets and weight
                tracking.
            </p>
            <a
                class="btn-primary btn-lg login-cta"
                href="/auth/google"
            >
                <Icon
                    name="tabler:brand-google-filled"
                    :size="18"
                />
                Continue with Google
            </a>
            <p
                v-if="failed"
                class="login-error"
            >
                Sign-in failed — please try again.
            </p>
        </div>
    </div>
</template>
