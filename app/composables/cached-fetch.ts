import type { AsyncData, NuxtApp } from '#app'

/**
 * The read endpoints backing a whole page. Keyed by endpoint path so the
 * payload cache, the warm-up and the mutation invalidations can't drift apart
 * on a typo.
 */
export const PAYLOAD = {
    dashboard: '/api/dashboard',
    workouts: '/api/workouts',
    sessions: '/api/sessions',
    exercises: '/api/exercises',
    bodyweight: '/api/bodyweight',
} as const

/**
 * `getCachedData` for the app. Nuxt's built-in default only restores the
 * payload cache while hydrating, so on our `ssr: false` pages every navigation
 * refetches from scratch and flashes an empty state before the data lands.
 * This serves the cached payload on the initial render of each navigation so
 * content appears instantly, while returning `undefined` for `refresh()`/watch
 * (any `cause` other than `'initial'`) so explicit refreshes still hit the
 * network — otherwise edits made elsewhere would stay masked by the cache.
 *
 * Uses an `in` check rather than `??` so a legitimately cached falsy value
 * still counts as a hit instead of refetching on every navigation.
 */
export function cachedPayload<T>(
    key: string,
    nuxtApp: NuxtApp,
    ctx: { cause: string },
): T | undefined {
    if (ctx.cause !== 'initial') return undefined
    const payload = nuxtApp.payload.data as Record<string, T>
    if (key in payload) return payload[key]
    const prerendered = nuxtApp.static.data as Record<string, T>
    if (key in prerendered) return prerendered[key]
    return undefined
}

/**
 * Stale-while-revalidate companion to {@link cachedPayload}. With `lazy: true`
 * Nuxt applies the cached value in `onBeforeMount`, so the refresh is scheduled
 * for `onMounted`: by then a cache hit has settled to `'success'` and we kick
 * off a background refresh to pick up edits made elsewhere, while a cache miss
 * is still `'pending'` (its initial fetch in flight) and is left untouched to
 * avoid a duplicate request. No-op on the server.
 */
export function revalidate(
    data: Pick<AsyncData<unknown, unknown>, 'status' | 'refresh'>,
): void {
    if (!import.meta.client) return
    onMounted(() => {
        if (data.status.value === 'success') void data.refresh()
    })
}

const settled = (s: string) => s === 'success' || s === 'error'

/**
 * True until the fetch first settles (`'success'` or `'error'`), then latches
 * false for the component's lifetime. Distinguishes "initial load, never had
 * data" (show a skeleton) from the `'pending'` that {@link revalidate}
 * re-triggers after a cache hit — including a cached empty list, which must
 * show its empty state, not a skeleton, on every navigation.
 */
export function initialLoading(
    data: Pick<AsyncData<unknown, unknown>, 'status'>,
): Readonly<Ref<boolean>> {
    const loading = shallowRef(!settled(data.status.value))
    if (loading.value) {
        const stop = watch(
            data.status,
            (s) => {
                if (!settled(s)) return
                loading.value = false
                stop()
            },
            // Sync flush: a cache hit settles in onBeforeMount, so the latch
            // must flip before the first render to avoid a skeleton flash.
            { flush: 'sync' },
        )
    }
    return readonly(loading)
}

/**
 * Drops cached payloads a write has just made wrong, so the next navigation
 * refetches instead of rendering a stale list for a beat. Call at setup — the
 * Nuxt instance has to be captured while the context is live, since a mutation
 * handler resumes after `await` with no context to look it up from.
 */
export function usePayloadCache(): (...keys: string[]) => void {
    const nuxtApp = useNuxtApp()
    return (...keys: string[]) => {
        for (const key of keys) delete nuxtApp.payload.data[key]
    }
}

let warmed = false

/**
 * Fire-and-forget prefetch of the list endpoints when the shell first mounts,
 * so the first visit to each page renders instantly via {@link cachedPayload}.
 * Runs once per browser session, at idle so the landing page's own fetch goes
 * first. Errors are dropped, never cached — the page's own fetch will surface
 * them. `!== undefined` rather than `in` because Nuxt itself treats `undefined`
 * cached data as a miss.
 */
export function warmPayloadCache(enabled: () => boolean): void {
    if (!import.meta.client || warmed) return
    warmed = true
    const nuxtApp = useNuxtApp()
    // onMounted + idle rather than onNuxtReady: that helper defers to
    // `app:suspense:resolve` while hydrating, a hook our `ssr: false` shell
    // never fires, so the callback would be dropped and nothing would warm.
    onMounted(() => {
        whenIdle(() => {
            // Checked here, not at call time: the auth guard has settled by
            // now, so a visitor on /login doesn't fire requests that 401.
            if (!enabled()) return
            for (const key of Object.values(PAYLOAD)) {
                if (nuxtApp.payload.data[key] !== undefined) continue
                void warmKey(nuxtApp, key)
            }
        })
    })
}

/** Runs after the current page's own work, without depending on Nuxt's hooks. */
function whenIdle(run: () => void): void {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(
            () => {
                run()
            },
            { timeout: 2000 },
        )
        return
    }
    setTimeout(run, 200)
}

async function warmKey(nuxtApp: NuxtApp, key: string): Promise<void> {
    try {
        const result = await $fetch<unknown>(key)
        if (nuxtApp.payload.data[key] === undefined) {
            nuxtApp.payload.data[key] = result
        }
    } catch {
        // The page's own fetch will report it; a warm-up must stay silent.
    }
}
