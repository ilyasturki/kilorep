import type { ParamMatcher } from '@sveltejs/kit';

// The server's own namespaces keep their real 404s rather than the app shell's.
export const match: ParamMatcher = (rest) => !/^(?:api|_app)(?:\/|$)/u.test(rest);
