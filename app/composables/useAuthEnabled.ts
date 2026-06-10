/**
 * Whether this instance runs multi-user (auth configured), probed from the
 * server by the global auth middleware; null until that first probe lands.
 */
export function useAuthEnabled() {
    return useState<boolean | null>('auth-enabled', () => null)
}
