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
