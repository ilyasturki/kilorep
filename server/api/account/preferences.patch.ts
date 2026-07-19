import { isSupportedLocale } from '~~/shared/locales'

defineRouteMeta({
    openAPI: {
        operationId: 'updateAccountPreferences',
        tags: ['account'],
        summary: 'Update the display preferences',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/AccountPreferences',
                    },
                },
            },
        },
        responses: {
            '200': {
                description: 'The updated display preferences.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/AccountPreferences',
                        },
                    },
                },
            },
            '400': {
                description: 'Unsupported locale tag.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ApiError',
                        },
                    },
                },
            },
        },
    },
})

export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const { locale } = body

    // null clears the pin (follow the device); otherwise it must be one of the
    // offered tags, so a client can't push arbitrary strings into Intl/reka.
    if (locale !== null && !isSupportedLocale(locale)) {
        badRequest('Unsupported locale')
    }

    setUserLocale(userId, locale)
    return { locale }
})
