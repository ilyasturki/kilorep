import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { PermissionState } from '@capacitor/core';

import { ensureRestPermission, scheduleRestEnd } from './rest.ts';

type Answer = { display: PermissionState };

const plugin = vi.hoisted(() => ({
	checkPermissions: vi.fn<() => Promise<Answer>>(),
	requestPermissions: vi.fn<() => Promise<Answer>>(),
	schedule: vi.fn(),
	cancel: vi.fn()
}));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));

function answers(display: PermissionState): void {
	plugin.checkPermissions.mockResolvedValue({ display });
}

beforeEach(() => {
	vi.clearAllMocks();
	answers('granted');
	plugin.requestPermissions.mockResolvedValue({ display: 'granted' });
});

describe('ensureRestPermission', () => {
	test('a denial is not remembered: lifted in the settings, the next rest gets through', async () => {
		answers('denied');
		expect(await ensureRestPermission()).toBe(false);

		answers('granted');
		expect(await ensureRestPermission()).toBe(true);
	});

	test('only an unanswered permission is asked for', async () => {
		answers('denied');
		await ensureRestPermission();

		expect(plugin.requestPermissions).not.toHaveBeenCalled();

		answers('prompt');
		expect(await ensureRestPermission()).toBe(true);
		expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
	});

	test('a plugin that throws is a no', async () => {
		plugin.checkPermissions.mockRejectedValueOnce(new Error('not implemented'));

		expect(await ensureRestPermission()).toBe(false);
	});
});

describe('scheduleRestEnd', () => {
	test('schedules a future end', async () => {
		await scheduleRestEnd(Date.now() + 60_000, 'Bench Press, next set up.');

		expect(plugin.schedule).toHaveBeenCalledTimes(1);
	});

	test('skips an end already behind us, which the plugin would fire at once', async () => {
		await scheduleRestEnd(Date.now() - 1, 'Next set up.');

		expect(plugin.schedule).not.toHaveBeenCalled();
	});

	test('schedules nothing without permission', async () => {
		answers('denied');

		await scheduleRestEnd(Date.now() + 60_000, 'Next set up.');

		expect(plugin.schedule).not.toHaveBeenCalled();
	});
});
