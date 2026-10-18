import type { Locator, Page } from '@playwright/test';

import type { Template } from '../../src/lib/domain/template.ts';
import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

import { readStore } from '../helpers.ts';

/** The device's copy of one record's payload, or null while it holds none. */
export async function held<T extends Template | FinishedWorkout>(
	page: Page,
	id: string
): Promise<T | null> {
	const { records } = await readStore(page);
	const record = records.find((candidate) => candidate.id === id && candidate.deletedAt === null);

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	return record === undefined ? null : (record.payload as T);
}

/** The record's own editor: the pencil in a desk's bar, the ⋮ menu on a phone. */
export async function beginEdit(page: Page): Promise<void> {
	const pencil = page.getByRole('banner').getByRole('button', { name: 'Edit this workout' });

	if (await pencil.isVisible()) {
		await pencil.click();
	} else {
		await page.getByRole('banner').getByRole('button', { name: 'Workout options' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Edit workout' }).click();
	}

	await page.getByRole('banner').getByRole('button', { name: 'SAVE', exact: true }).waitFor();
}

/** One exercise's block on a past workout. */
export function recordBlock(page: Page, name: string): Locator {
	return page
		.getByRole('main')
		.locator('section', { has: page.getByRole('heading', { name, exact: true }) });
}
