import { isSupportedLocale } from '~~/shared/locales'

export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const { locale } = body

    // null clears the pin (follow the device); otherwise it must be one of the
    // offered tags, so a client can't push arbitrary strings into Intl/reka.
    if (locale !== null && !isSupportedLocale(locale)) {
        badRequest('Unsupported locale')
    }

    setUserLocale(userId, locale as string | null)
    return { locale }
})
