// Mints a nuxt-auth-utils session cookie (iron-sealed h3 session) for tests.
// CLI usage: node mint-session.mjs <password> <userId> <name> <email>
import { webcrypto } from 'node:crypto'
import { defaults, seal } from 'iron-webcrypto'

export function mintSession(user, password, ttl = 30 * 24 * 3600 * 1000) {
    const session = {
        id: `test-${user.id}`,
        createdAt: Date.now(),
        data: { user },
    }
    return seal(webcrypto, session, password, { ...defaults, ttl })
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [password, userId, name, email] = process.argv.slice(2)
    const user = { id: Number(userId), name, email, avatarUrl: null }
    console.log(await mintSession(user, password))
}
