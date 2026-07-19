import type { WorkoutWithEntries } from '~~/server/database/schema'

// One keyed fetch of the workout list shared between the sidebar CTA and the
// Workouts history page, so the "Start / Continue" label stays correct app-wide
// without a second round-trip. Lazy so the heavier non-workout pages aren't
// blocked on it during navigation. The list arrives newest-first, so the first
// unfinished workout is the one to resume.
export function useActiveWorkout() {
    const { data, status, refresh } = useFetch<WorkoutWithEntries[]>(
        PAYLOAD.workouts,
        {
            key: PAYLOAD.workouts,
            server: false,
            lazy: true,
            default: () => [],
            getCachedData: cachedPayload,
        },
    )
    revalidate({ status, refresh })
    const loading = initialLoading({ status })
    const workouts = computed(() => data.value ?? [])
    const active = computed(
        () => workouts.value.find((w) => !w.completed) ?? null,
    )
    return { workouts, active, status, loading, refresh }
}
