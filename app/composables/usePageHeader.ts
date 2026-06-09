export type PageHeader = {
    title: string
    tag?: { label: string; accent?: boolean }
    back?: string
}

// Lets a page override the global topbar (title, status tag, back link) instead
// of the route-derived section name. app.vue reads it; a page drives it.
//
// Call with no args to read the current header. Call with a getter to own it
// from a page: the header tracks the getter and resets when the page unmounts,
// so a page never has to repeat the mount/unmount dance. The watcher is
// client-only so a server render and the first client paint emit the same
// fallback markup (no hydration mismatch).
export function usePageHeader(source?: () => PageHeader | null) {
    const header = useState<PageHeader | null>('page-header', () => null)
    if (source && import.meta.client) {
        watchEffect(() => {
            header.value = source()
        })
        onScopeDispose(() => {
            header.value = null
        })
    }
    return header
}
