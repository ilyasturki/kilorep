// Mints a nuxt-auth-utils session cookie (iron-sealed h3 session) for tests.
// Usage: node mint-session.mjs <password> <userId> <name> <email>
import { webcrypto } from 'node:crypto'
import { defaults, seal } from 'iron-webcrypto'

const [password, userId, name, email] = process.argv.slice(2)
const session = {
    id: `test-${userId}`,
    createdAt: Date.now(),
    data: {
        user: {
            id: Number(userId),
            name,
            email,
            avatarUrl: null,
        },
    },
}
const sealed = await seal(webcrypto, session, password, {
    ...defaults,
    ttl: 30 * 24 * 3600 * 1000,
})
console.log(sealed)
