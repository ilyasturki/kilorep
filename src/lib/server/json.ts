/**
 * The one guard every "I just parsed JSON and now have `unknown`" site needs.
 *
 * `Array.isArray` is the clause that gets forgotten, and forgetting it is not
 * harmless: `typeof [] === 'object'` and `[] !== null`, so a JSON array walks
 * straight through the two obvious checks and is then indexed by field name,
 * yielding `undefined` for every one of them. Named once, it cannot be
 * half-remembered at the fourth call site.
 *
 * Its own module, importing nothing, because the callers do not share a layer:
 * the HTTP body reader, the OAuth token response and the handshake cookie all
 * need it, and two of those are deliberately framework-free.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The same guard over a body nobody has read yet. Undefined covers every way it
 * can fail — unread, unparseable, or parsed into something that is not an object
 * — because no caller yet has told them apart.
 */
export async function jsonObject(
	source: Request | Response
): Promise<Record<string, unknown> | undefined> {
	try {
		const parsed: unknown = await source.json();
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}
