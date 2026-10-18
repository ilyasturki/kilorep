import { describe, expect, it, vi } from 'vitest';

import { parentOf, tabRoots } from './bar.svelte';
import { legacyAddress as moved } from './legacy';

vi.mock('$lib/ui/icons/Barbell.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/BarbellFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBar.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/ChartBarFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gauge.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/GaugeFill.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Gear.svelte', () => ({ default: {} }));
vi.mock('$lib/ui/icons/Stack.svelte', () => ({ default: {} }));
vi.mock('$lib/workout/active.svelte', () => ({ activeWorkout: { session: null } }));

function legacyAddress(address: string): string | null {
	return moved(new URL(address, 'https://kilorep.test'));
}

describe('legacyAddress', () => {
	it('sends each renamed address to the one that replaced it', () => {
		expect(legacyAddress('/workout')).toBe('/train');
		expect(legacyAddress('/workout/live')).toBe('/train/live');
		expect(legacyAddress('/weight')).toBe('/bodyweight');
		expect(legacyAddress('/templates')).toBe('/plan/templates');
		expect(legacyAddress('/exercises')).toBe('/plan/exercises');
		expect(legacyAddress('/dashboard')).toBe('/progress');
		expect(legacyAddress('/start')).toBe('/train');
	});

	it('keeps the id tail, however deep', () => {
		expect(legacyAddress('/templates/t1')).toBe('/plan/templates/t1');
		expect(legacyAddress('/templates/t1/history')).toBe('/plan/templates/t1/history');
		expect(legacyAddress('/exercises/bench-press')).toBe('/plan/exercises/bench-press');
	});

	it('keeps the query, which can carry where back goes', () => {
		expect(legacyAddress('/exercises/deadlift?from=%2Fworkout%2Flive')).toBe(
			'/plan/exercises/deadlift?from=%2Fworkout%2Flive'
		);
		expect(legacyAddress('/workout?start=next')).toBe('/train?start=next');
	});

	it('never reads the query of an address it does not move', () => {
		const url = new URL('https://kilorep.test/');

		Object.defineProperty(url, 'search', {
			get() {
				throw new Error('read');
			}
		});

		expect(moved(url)).toBeNull();
	});

	it('matches whole segments, never a prefix of one', () => {
		expect(legacyAddress('/workouts')).toBeNull();
		expect(legacyAddress('/weights/x')).toBeNull();
		expect(legacyAddress('/templatesx')).toBeNull();
	});

	it('leaves every address the app answers at today alone', () => {
		for (const current of [
			'/train',
			'/train/live',
			'/bodyweight',
			'/plan/templates/t1',
			'/plan/exercises/bench-press',
			'/history/w1',
			'/progress',
			'/settings',
			'/'
		]) {
			expect(legacyAddress(current)).toBeNull();
		}
	});

	it('stays out of the tab grid and the hierarchy', () => {
		for (const old of ['/workout', '/workout/live', '/weight', '/templates', '/exercises']) {
			expect(tabRoots()).not.toContain(old);
			expect(parentOf(old)).toBeNull();
		}

		expect(parentOf('/templates/t1')).toBeNull();
		expect(parentOf('/exercises/bench-press')).toBeNull();
	});
});
