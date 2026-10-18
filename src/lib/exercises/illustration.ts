import drawn from './illustrations.json';

const shipped: ReadonlySet<string> = new Set(drawn);

export function resolveIllustration(
	available: ReadonlySet<string>,
	id: string,
	grip?: string | null
): string | null {
	if (typeof grip === 'string' && available.has(`${id}--${grip}`)) {
		return `${id}--${grip}`;
	}

	return available.has(id) ? id : null;
}

export function illustrationFor(id: string, grip?: string | null): string | null {
	return resolveIllustration(shipped, id, grip);
}
