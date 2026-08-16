import { LocalNotifications } from '@capacitor/local-notifications';

// One id app-wide: rescheduling replaces the pending notification, never stacks.
const REST_NOTIFICATION_ID = 1;

let allowed: boolean | undefined;

export async function ensureRestPermission(): Promise<boolean> {
	if (allowed !== undefined) {
		return allowed;
	}

	try {
		const current = await LocalNotifications.checkPermissions();

		const settled =
			current.display === 'granted' || current.display === 'denied'
				? current
				: await LocalNotifications.requestPermissions();

		allowed = settled.display === 'granted';
	} catch {
		allowed = false;
	}

	return allowed;
}

// `allowWhileIdle` needs `SCHEDULE_EXACT_ALARM` in the Android manifest; a past
// `at` is skipped because the plugin fires those immediately.
export async function scheduleRestEnd(at: number, body: string): Promise<void> {
	if (at <= Date.now() || !(await ensureRestPermission())) {
		return;
	}

	try {
		await LocalNotifications.schedule({
			notifications: [
				{
					id: REST_NOTIFICATION_ID,
					title: 'Rest over',
					body,
					schedule: { at: new Date(at), allowWhileIdle: true }
				}
			]
		});
	} catch {
		/* empty */
	}
}

export async function cancelRestEnd(): Promise<void> {
	try {
		await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
	} catch {
		/* empty */
	}
}
