import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { StoredRecord } from '../src/lib/store/db.ts';

export type ClientStore = { records: StoredRecord[]; meta: Record<string, unknown> };

const RECORD_PATH = /^\/history\/[^/]+$/u;

function escaped(text: string): string {
	return text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}

function recordId(page: Page): string {
	return new URL(page.url()).pathname.split('/').at(-1) ?? '';
}

/** Starts a plan from Train, up next or further down; a page already on Train is not reloaded. */
export async function startPlan(page: Page, name: string): Promise<void> {
	if (new URL(page.url()).pathname !== '/train') {
		await page.goto('/train');
	}

	const main = page.getByRole('main');
	const listed = main.getByRole('button', { name: new RegExp(`^${escaped(name)} `, 'u') });

	await expect(main.getByText(name, { exact: true }).first()).toBeVisible();

	const start =
		(await listed.count()) > 0 ? listed : main.getByRole('button', { name: 'START', exact: true });
	await start.click();

	await page.waitForURL('**/train/live');
}

export async function startEmpty(page: Page): Promise<void> {
	await page.goto('/train');
	await page
		.getByRole('main')
		.getByRole('button', { name: /^(?:Empty workout|Start an empty workout)/u })
		.click();
	await page.waitForURL('**/train/live');
}

/** Through the picker, from the last add button on the screen: a session's or a plan's. */
export async function addExercise(page: Page, name: string): Promise<void> {
	await page
		.getByRole('button', { name: /^(?:Add exercise|Exercise)$/u })
		.last()
		.click();

	const picker = page.getByRole('dialog', { name: 'Add exercise' });
	await picker.getByRole('searchbox').or(picker.getByRole('textbox')).fill(name);
	await picker
		.getByRole('button', { name: new RegExp(`^${escaped(name)} `, 'u') })
		.first()
		.click();

	const commit = picker.getByRole('button', { name: /^Add \d+ exercises?$/u });
	await expect.poll(async () => (await picker.isHidden()) || (await commit.isVisible())).toBe(true);

	if (await commit.isVisible()) {
		await commit.click();
	}

	await expect(picker).toBeHidden();
}

/**
 * Logs the set the session points at, at its offered numbers unless `kg` or `reps` say
 * otherwise: typed into the tray on a phone, stepped on the desk ledger.
 */
export async function logSet(page: Page, set: { kg?: number; reps?: number } = {}): Promise<void> {
	const typed = {
		kg: page.getByRole('textbox', { name: 'kg' }),
		reps: page.getByRole('textbox', { name: 'reps' })
	};

	if (await typed.kg.isVisible()) {
		for (const field of ['kg', 'reps'] as const) {
			const value = set[field];

			if (value !== undefined) {
				await typed[field].fill(String(value));
				await typed[field].blur();
			}
		}
		await page.getByRole('button', { name: 'Log set', exact: true }).click();

		return;
	}

	const commit = page.getByRole('main').getByRole('button', { name: /^Log \S+ × \d+$/u });

	// A set with nothing offered draws no Log button until both numbers hold something.
	if (!(await commit.isVisible())) {
		if (set.kg === undefined || set.reps === undefined) {
			throw new Error('a set with nothing offered needs both kg and reps');
		}

		await page.getByRole('button', { name: 'Raise weight' }).click();
		await page.getByRole('button', { name: 'Raise reps' }).click();
		await expect(commit).toBeVisible();
	}

	for (let step = 0; step < 200; step += 1) {
		const label = (await commit.getAttribute('aria-label')) ?? '';
		const [, kg = '', reps = ''] = /^Log (?<kg>\S+) × (?<reps>\d+)$/u.exec(label) ?? [];

		if (set.kg !== undefined && Number(kg) !== set.kg) {
			await page
				.getByRole('button', { name: Number(kg) < set.kg ? 'Raise weight' : 'Lower weight' })
				.click();
		} else if (set.reps !== undefined && Number(reps) !== set.reps) {
			await page
				.getByRole('button', { name: Number(reps) < set.reps ? 'Raise reps' : 'Lower reps' })
				.click();
		} else {
			await commit.click();

			return;
		}
	}

	throw new Error(`the desk ledger could not step to ${JSON.stringify(set)}`);
}

/** FINISH, through the "sets still owed" question if it is asked; resolves to the record's id. */
export async function finish(page: Page): Promise<string> {
	await page.getByRole('banner').getByRole('button', { name: 'FINISH', exact: true }).click();

	const confirm = page
		.getByRole('alertdialog')
		.getByRole('button', { name: 'Finish', exact: true });
	const onRecord = (): boolean => RECORD_PATH.test(new URL(page.url()).pathname);

	await expect.poll(async () => onRecord() || (await confirm.isVisible())).toBe(true);

	if (!onRecord()) {
		await confirm.click();
	}

	await expect.poll(onRecord).toBe(true);

	return recordId(page);
}

/** Opens the newest History row titled `title`; resolves to the record's id. */
export async function openRecord(page: Page, title: string): Promise<string> {
	await page.goto('/history');
	await page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`^${escaped(title)} `, 'u') })
		.first()
		.click();
	await page.waitForURL((url) => RECORD_PATH.test(url.pathname));

	return recordId(page);
}

/** The page's IndexedDB `kilorep`, as plain data; empty before the app first opens it. */
export async function readStore(page: Page): Promise<ClientStore> {
	const store = await page.evaluate(async () => {
		// Declared in here because `evaluate` ships this one function to the page, nothing around it.
		// oxlint-disable-next-line unicorn/consistent-function-scoping
		async function settled<T>(request: IDBRequest<T>): Promise<T> {
			// oxlint-disable-next-line promise/avoid-new
			const result = await new Promise<T>((resolve, reject) => {
				request.addEventListener('success', () => {
					resolve(request.result);
				});
				request.addEventListener('error', () => {
					reject(request.error ?? new Error('kilorep could not be read'));
				});
			});

			return result;
		}

		// Opening a database that does not exist yet would create it without its stores.
		const known = await indexedDB.databases();
		if (!known.some(({ name }) => name === 'kilorep')) {
			return { records: [], meta: {} };
		}

		const db = await settled(indexedDB.open('kilorep'));
		const tx = db.transaction(['records', 'meta']);
		const [records, keys, values]: [StoredRecord[], IDBValidKey[], unknown[]] = await Promise.all([
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			settled(tx.objectStore('records').getAll() as IDBRequest<StoredRecord[]>),
			settled(tx.objectStore('meta').getAllKeys()),
			settled<unknown[]>(tx.objectStore('meta').getAll())
		]);
		db.close();

		return {
			records,
			meta: Object.fromEntries(
				keys.map((key, at) => [typeof key === 'string' ? key : JSON.stringify(key), values[at]])
			)
		};
	});

	return store;
}

/** Until the server has acked every local write. Called before the write reaches the store, it returns at once. */
export async function waitForSync(page: Page): Promise<void> {
	await expect
		.poll(
			async () => {
				const { records } = await readStore(page);

				return records.filter(({ dirty }) => dirty).length;
			},
			{
				message: 'local writes still waiting for the server',
				timeout: 15_000
			}
		)
		.toBe(0);
}

/** A sync right now, the way the network coming back starts one. */
export async function syncNow(page: Page): Promise<void> {
	await page.context().setOffline(true);
	await page.context().setOffline(false);
}
