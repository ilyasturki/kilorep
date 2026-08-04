import type { Exercise } from '$lib/domain/exercise';

export function normalize(raw: string): string {
	return raw
		.toLowerCase()
		.normalize('NFD')
		.replaceAll(/[\u0300-\u036F]/gu, '')
		.replaceAll('-', ' ')
		.replaceAll(/\s+/gu, ' ')
		.trim();
}

function substringRank(query: string, name: string, aliases: string[]): number {
	if (name.startsWith(query)) {
		return 0;
	}

	if (name.split(' ').some((word) => word.startsWith(query))) {
		return 1;
	}

	if (aliases.some((a) => a.startsWith(query) || a.split(' ').some((w) => w.startsWith(query)))) {
		return 2;
	}

	if (name.includes(query)) {
		return 3;
	}

	if (aliases.some((a) => a.includes(query))) {
		return 4;
	}

	return -1;
}

/** Classic two-row Levenshtein. The pool is small; clarity beats cleverness. */
function editDistance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

	for (let i = 1; i <= a.length; i++) {
		const current = [i];

		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
		}

		previous = current;
	}

	return previous[b.length];
}

function bestDistance(query: string, name: string, aliases: string[]): number {
	const words = [name, ...name.split(' '), ...aliases.flatMap((a) => [a, ...a.split(' ')])];

	return Math.min(...words.map((word) => editDistance(query, word)));
}

export function searchExercises(pool: Exercise[], query: string): Exercise[] {
	const q = normalize(query);

	if (q === '') {
		return pool;
	}

	const entries = pool.map((exercise) => ({
		exercise,
		name: normalize(exercise.name),
		aliases: exercise.aliases.map(normalize)
	}));

	const scored = entries
		.map(({ exercise, name, aliases }) => ({ exercise, rank: substringRank(q, name, aliases) }))
		.filter((s) => s.rank !== -1);

	if (scored.length > 0) {
		return scored
			.toSorted((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name))
			.map((s) => s.exercise);
	}

	const allowed = q.length <= 4 ? 1 : 2;

	return entries
		.map(({ exercise, name, aliases }) => ({
			exercise,
			distance: bestDistance(q, name, aliases)
		}))
		.filter((s) => s.distance <= allowed)
		.toSorted((a, b) => a.distance - b.distance || a.exercise.name.localeCompare(b.exercise.name))
		.map((s) => s.exercise);
}

export type MatchRange = { start: number; end: number };

export function matchRange(name: string, query: string): MatchRange | null {
	const q = normalize(query);

	if (q === '') {
		return null;
	}

	let text = '';
	const origin: number[] = [];

	for (let i = 0; i < name.length; i++) {
		const folded = name[i]
			.toLowerCase()
			.normalize('NFD')
			.replaceAll(/[\u0300-\u036F]/gu, '')
			.replaceAll('-', ' ');

		for (const char of folded) {
			const next = /\s/u.test(char) ? ' ' : char;

			if (next === ' ' && (text === '' || text.endsWith(' '))) {
				continue;
			}

			text += next;
			origin.push(i);
		}
	}

	const at = text.indexOf(q);

	if (at === -1) {
		return null;
	}

	return { start: origin[at], end: origin[at + q.length - 1] + 1 };
}
