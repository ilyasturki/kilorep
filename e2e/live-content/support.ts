import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export function onDesk(page: Page): boolean {
	const viewport = page.viewportSize();

	return viewport !== null && viewport.width >= 1024;
}

/** The phone's section of an exercise, or its block of the desk ledger. */
export function exerciseBlock(page: Page, name: string): Locator {
	const options = page.getByRole('button', { name: `${name} options`, exact: true });

	return page.getByRole('main').locator('section, [data-drag-id]', { has: options });
}

/** A set's row, by the label its mark reads: `set 2 pending`, `warmup set`, `set A1 logged`. */
export function setRow(block: Locator, mark: string | RegExp): Locator {
	const exact = typeof mark === 'string';

	// A ledger row is a clickable grid with no role; its mark sits in the first cell.
	return onDesk(block.page())
		? block.getByRole('img', { name: mark, exact }).locator('xpath=../..')
		: block
				.getByRole('button')
				.filter({ has: block.page().getByRole('img', { name: mark, exact }) });
}

export function tray(page: Page): Locator {
	return page.getByRole('button', { name: /^(?:Lower|Raise) the set editor$/u }).locator('..');
}

/** What the tray's Last label reads: the hint, or First time. */
export function trayLast(page: Page): Locator {
	return tray(page).getByText('Last', { exact: true }).locator('xpath=following-sibling::span');
}

export function menuItem(page: Page, name: string): Locator {
	return page
		.getByRole('menuitem', { name, exact: true })
		.or(page.getByRole('dialog').getByRole('button', { name, exact: true }));
}

export async function exerciseAction(page: Page, name: string, action: string): Promise<void> {
	await page.getByRole('button', { name: `${name} options`, exact: true }).click();
	await menuItem(page, action).click();
}

type Point = { x: number; y: number };

async function centreOf(target: Locator): Promise<Point> {
	const box = await target.boundingBox();

	if (box === null) {
		throw new Error('nothing there to touch');
	}

	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A finger rather than the mouse: its pointer is captured by what it lands on, so the release
// still reaches the row when a sheet opened over it mid-press.
async function finger(page: Page, path: Point[], held?: Locator): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	const [start, ...moves] = path;

	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });

	if (held !== undefined) {
		await expect(held).toBeVisible();
	}

	for (const point of moves) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
	}

	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

/** Holds a finger down until what the hold opens is on screen. */
export async function longPress(page: Page, target: Locator, opens: Locator): Promise<void> {
	await finger(page, [await centreOf(target)], opens);
}

/** A finger dragged from the middle of `target` by `dx`, `dy`, in even steps. */
export async function drag(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
	const from = await centreOf(target);
	const steps = 16;

	await finger(
		page,
		Array.from({ length: steps + 1 }, (_, at) => ({
			x: from.x + (dx * at) / steps,
			y: from.y + (dy * at) / steps
		}))
	);
}
