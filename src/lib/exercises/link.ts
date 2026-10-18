import { FOLDED } from '$lib/catalog';

const GRIP = 'grip';

export function exerciseHref(
	exerciseId: string,
	grip?: string | null,
	from?: string | null
): string {
	const query = new URLSearchParams();

	if (grip !== undefined && grip !== null) {
		query.set(GRIP, grip);
	}

	if (from !== undefined && from !== null) {
		query.set('from', from);
	}

	const search = query.toString();

	return search === ''
		? `/plan/exercises/${exerciseId}`
		: `/plan/exercises/${exerciseId}?${search}`;
}

export function foldedHref(exerciseId: string, search: string): string | null {
	const fold = FOLDED[exerciseId] as { id: string; grip: string } | undefined;

	if (fold === undefined) {
		return null;
	}

	const query = new URLSearchParams(search);

	if (!query.has(GRIP)) {
		query.set(GRIP, fold.grip);
	}

	return `/plan/exercises/${fold.id}?${query.toString()}`;
}
