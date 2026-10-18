const MOVED: readonly (readonly [string, string])[] = [
	['/workout', '/train'],
	['/weight', '/bodyweight'],
	['/templates', '/plan/templates'],
	['/exercises', '/plan/exercises'],
	['/dashboard', '/progress'],
	['/start', '/train']
];

export function legacyAddress(url: URL): string | null {
	const { pathname } = url;

	for (const [old, now] of MOVED) {
		if (pathname === old || pathname.startsWith(`${old}/`)) {
			// Read on a match only: a prerendered page throws on any read of `search`.
			return `${now}${pathname.slice(old.length)}${url.search}`;
		}
	}

	return null;
}
