import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { goto } from '$app/navigation';
import { closeTopOverlay, hasOpenOverlay, registerOverlay } from '$lib/ui/overlays';

import { stack } from './stack.svelte';

import { backDecision, closesOverlay, follow, goBack, leave, leaveFor, retreatingTo } from './go';

vi.mock('$lib/ui/icons/Barbell.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/BarbellFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBar.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBarFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gauge.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/GaugeFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gear.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Stack.svelte', () => ({ default: {} }));
vi.mock('$lib/workout/active.svelte', () => ({ activeWorkout: { session: null } }));
vi.mock('./stack.svelte', () => ({ stack: { behind: null, at: null } }));

const seen: string[] = [];

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async (path: string) => {
		seen.push(`goto ${path} retreating=${String(retreatingTo(path))}`);

		await Promise.resolve();
	})
}));

const back = vi.fn();

function standOn(address: string, behind: string | null): void {
	vi.stubGlobal('location', new URL(address, 'https://kilorep.test'));
	stack.behind = behind;
	stack.at = null;
}

beforeEach(() => {
	vi.stubGlobal('history', { back });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	seen.length = 0;

	// Any navigation settles a pop the app asked for; this one stands in for it.
	closesOverlay('link');

	while (hasOpenOverlay()) {
		closeTopOverlay();
	}
});

describe('a back press', () => {
	it('pops when the record list is behind the record', async () => {
		standOn('/history/w1', '/history');

		await goBack();

		expect(back).toHaveBeenCalledOnce();
		expect(goto).not.toHaveBeenCalled();
	});

	it('replaces the record with the list when the list is not behind it, and says it retreated', async () => {
		standOn('/history/w1', '/train');

		await goBack();

		expect(back).not.toHaveBeenCalled();
		expect(goto).toHaveBeenCalledWith('/history', { replaceState: true });
		expect(seen).toEqual(['goto /history retreating=true']);
		expect(retreatingTo('/history')).toBe(false);
	});

	it('closes the open overlay and goes nowhere', async () => {
		const close = vi.fn<() => void>();

		standOn('/history/w1', '/history');
		registerOverlay(close);

		await goBack();

		expect(close).toHaveBeenCalledOnce();
		expect(back).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it('decides from the address the stack last landed on, not one still loading', () => {
		standOn('/plan/templates', '/history');
		stack.at = '/history/w1';

		expect(backDecision()).toEqual({ kind: 'pop' });
	});

	it('leaves minimizing to the shell: at a tab root nothing in the page moves', async () => {
		standOn('/progress', '/train');

		expect(backDecision()).toEqual({ kind: 'minimize' });

		await follow(backDecision());

		expect(back).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('a jump whose source is spent', () => {
	it('pops back into the session an exercise was opened from', async () => {
		standOn('/plan/exercises/curl?from=%2Ftrain%2Flive', '/train/live');

		await leaveFor('/train/live');

		expect(back).toHaveBeenCalledOnce();
	});

	it('replaces the exercise with the session when it was browsed to', async () => {
		standOn('/plan/exercises/curl', '/plan/exercises');

		await leaveFor('/train/live');

		expect(goto).toHaveBeenCalledWith('/train/live', { replaceState: true });
	});

	it('ignores an overlay still closing, which a confirm that deletes always is', async () => {
		standOn('/history/w1', '/history');
		registerOverlay(() => {
			/* the confirm, mid-close */
		});

		await leave('/history');

		expect(back).toHaveBeenCalledOnce();
	});

	it('leaves a deleted record for where its back walks, `from` included', async () => {
		standOn('/history/w1?from=%2Fplan%2Fexercises%2Fsquat', '/plan/exercises/squat');

		await leave('/history');

		expect(back).toHaveBeenCalledOnce();

		standOn('/plan/templates/t1', null);

		await leave('/plan/templates');

		expect(goto).toHaveBeenCalledWith('/plan/templates', { replaceState: true });
	});
});

describe('the browser back', () => {
	it('closes the top overlay instead of navigating', () => {
		const close = vi.fn<() => void>();

		registerOverlay(close);

		expect(closesOverlay('popstate')).toBe(true);
		expect(close).toHaveBeenCalledOnce();
		expect(hasOpenOverlay()).toBe(false);
	});

	it('navigates when nothing is open, and for anything but a pop', () => {
		expect(closesOverlay('popstate')).toBe(false);

		registerOverlay(() => {
			/* a sheet whose link was followed */
		});

		expect(closesOverlay('link')).toBe(false);
		expect(closesOverlay('popstate', 1)).toBe(false);
		expect(hasOpenOverlay()).toBe(true);
	});

	it('lets through the pop the app asked for itself', async () => {
		standOn('/history/w1', '/history');

		await leave('/history');

		registerOverlay(() => {
			/* the confirm, mid-close */
		});

		expect(closesOverlay('popstate')).toBe(false);
		expect(closesOverlay('popstate')).toBe(true);
	});
});
