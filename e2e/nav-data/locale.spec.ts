import { expect, test } from '../fixtures.ts';
import { openRecord, startPlan } from '../helpers.ts';

const MONTH = String.raw`(?:janv\.|févr\.|mars|avr\.|mai|juin|juil\.|août|sept\.|oct\.|nov\.|déc\.)`;
const WEEKDAY = String.raw`(?:lun|mar|mer|jeu|ven|sam|dim)\.`;
const DECIMAL = String.raw`\d+,\d`;

test.use({ seeded: true });

test.describe('on a French device', () => {
	test.use({ locale: 'fr-FR' });

	test('Weight reads its numbers with a comma', async ({ page, account }) => {
		void account;
		await page.goto('/bodyweight');
		const main = page.getByRole('main');

		await expect(main.getByRole('textbox', { name: 'kg' })).toHaveValue(
			new RegExp(`^${DECIMAL}$`, 'u')
		);
		await expect(
			main.getByText(new RegExp(`^[−+]?${DECIMAL} kg · low ${DECIMAL} · high ${DECIMAL}$`, 'u'))
		).toBeVisible();
		await expect(
			main.getByRole('button', { name: new RegExp(`^Yesterday ${DECIMAL} kg$`, 'u') })
		).toBeVisible();
		await expect(
			main.getByRole('button', { name: new RegExp(`^${MONTH} \\d{4} avg ${DECIMAL}`, 'u') }).first()
		).toBeVisible();
		await expect(
			main.getByRole('heading', { name: new RegExp(`^Today · ${WEEKDAY} \\d{1,2} ${MONTH}$`, 'u') })
		).toBeVisible();
	});

	test('History and a record date the French way, in English words', async ({ page, account }) => {
		void account;
		await page.goto('/history');
		await expect(
			page
				.getByRole('main')
				.getByRole('link', {
					name: new RegExp(
						`^Push Day 5 exercises · \\d+ sets (?:${WEEKDAY}, )?\\d{1,2} ${MONTH}$`,
						'u'
					)
				})
				.first()
		).toBeVisible();

		await openRecord(page, 'Push Day');
		await expect(
			page.getByText(new RegExp(`^${WEEKDAY} \\d{1,2} ${MONTH} \\d{4} · \\d{2}:\\d{2} · `, 'u'))
		).toBeVisible();
		await expect(page.getByRole('main').getByText('9,5', { exact: true }).first()).toBeVisible();
	});

	test('a weight typed with the comma keeps it', { tag: '@phone' }, async ({ page, account }) => {
		void account;
		await startPlan(page, 'Pull Day');
		const kg = page.getByRole('textbox', { name: 'kg' });
		await expect(kg).toHaveValue(new RegExp(`^${DECIMAL}$|^\\d+$`, 'u'));

		await kg.fill('82,5');
		await kg.blur();
		await expect(kg).toHaveValue('82,5');

		await page.getByRole('textbox', { name: 'reps' }).fill('5');
		await page.getByRole('button', { name: 'Log set', exact: true }).click();
		await expect(page.getByRole('button', { name: 'set logged 82,5 kg × 5 Logged' })).toBeVisible();

		await kg.fill('80.5');
		await kg.blur();
		await expect(kg).toHaveValue('80,5');
	});

	test(
		'the desk ledger offers its weights with a comma',
		{ tag: '@desk' },
		async ({ page, account }) => {
			void account;
			await startPlan(page, 'Pull Day');
			await expect(
				page
					.getByRole('main')
					.getByRole('button', { name: new RegExp(`^Log ${DECIMAL} × \\d+$`, 'u') })
					.first()
			).toBeVisible();
		}
	);
});

test.describe('back on an English device', () => {
	test.describe('in Britain', () => {
		test.use({ locale: 'en-GB' });

		test('dates read day first', async ({ page, account }) => {
			void account;
			await page.goto('/bodyweight');
			await expect(
				page
					.getByRole('main')
					.getByRole('heading', { name: /^Today · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/u })
			).toBeVisible();
			await expect(page.getByRole('textbox', { name: 'kg' })).toHaveValue(/^\d+\.\d$/u);

			await page.goto('/history');
			await expect(
				page
					.getByRole('main')
					.getByRole('link', { name: /^Push Day .* \d{1,2} [A-Z][a-z]{2}$/u })
					.first()
			).toBeVisible();
		});
	});

	test.describe('in the US', () => {
		test.use({ locale: 'en-US' });

		test('dates read month first', async ({ page, account }) => {
			void account;
			await page.goto('/history');
			await expect(
				page
					.getByRole('main')
					.getByRole('link', { name: /^Push Day .* [A-Z][a-z]{2} \d{1,2}$/u })
					.first()
			).toBeVisible();
		});
	});
});
