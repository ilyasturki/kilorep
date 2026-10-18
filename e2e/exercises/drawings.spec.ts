import { catalog } from '../../src/lib/catalog.ts';
import { APP_URL, WEB_URL } from '../env.ts';
import { expect, test } from '../fixtures.ts';

// Every exercise has its drawing, and every grip but the default has its own.
const files = catalog.flatMap(({ id, grips }) =>
	grips === undefined
		? [id]
		: [
				id,
				...grips.values
					.filter((value) => value.id !== grips.default)
					.map((value) => `${id}--${value.id}`)
			]
);

for (const [build, origin] of [
	['web', WEB_URL],
	['app', APP_URL]
] as const) {
	test(`the ${build} build serves a drawing for every exercise and grip`, async ({ request }) => {
		const missing: string[] = [];

		await Promise.all(
			files.map(async (file) => {
				const response = await request.get(`${origin}/illustrations/${file}.svg`);
				const text = response.ok() ? await response.text() : '';

				if (!text.startsWith('<svg') || !text.includes('<path')) {
					missing.push(file);
				}
			})
		);

		expect(missing.toSorted()).toEqual([]);
	});
}

test(
	'every exercise in the list shows its drawing',
	{ tag: '@phone' },
	async ({ account: _signedIn, page }) => {
		await page.goto('/plan/exercises');

		const roots = catalog.filter((exercise) => exercise.variantOf === undefined);
		const drawn = page.getByRole('main').getByRole('img', { name: / illustration$/u });

		await expect(drawn).toHaveCount(roots.length);
		for (const exercise of roots) {
			await expect(
				page.getByRole('img', { name: `${exercise.name} illustration`, exact: true }).locator('svg')
			).toHaveCount(1);
		}
	}
);
