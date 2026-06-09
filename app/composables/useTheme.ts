// Dark-first theme, persisted to localStorage. The attribute lands on <html>
// so portalled overlays (dialogs, toasts, select popovers) inherit the tokens.
export function useTheme() {
    const mode = useColorMode({
        attribute: 'data-theme',
        modes: { dark: 'dark', light: 'light' },
        initialValue: 'dark',
        storageKey: 'lift-theme',
        disableTransition: true,
    })

    const isDark = computed(() => mode.value !== 'light')

    function set(value: 'dark' | 'light') {
        mode.value = value
    }

    function toggle() {
        set(isDark.value ? 'light' : 'dark')
    }

    return { mode, isDark, set, toggle }
}
