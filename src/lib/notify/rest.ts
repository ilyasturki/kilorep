import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * The one thing that reaches a phone in a pocket.
 *
 * PRODUCT.md forbids holding the screen awake — the phone's own timeout is the
 * user's setting — which leaves a dark screen as the normal condition of a rest
 * and the OS as the only clock that survives it. A `setTimeout` in a suspended
 * WebView does not fire, and an audio tag is throttled on Android within
 * seconds of backgrounding. A scheduled notification is what is left.
 *
 * Every call is a no-op that resolves on the web, where there is no plugin
 * behind the import: the bar still counts down on screen and the buzz still
 * lands where a haptics engine exists. A browser tab is not the gym floor, and
 * asking a laptop for notification permission to time a set nobody is lifting
 * would be the app misreading where it is.
 */

/**
 * One id for the whole app, deliberately. Rescheduling replaces rather than
 * stacks, so a ±30s cannot leave the old end time pending behind the new one —
 * which is the bug that makes a rest timer buzz twice.
 */
const REST_NOTIFICATION_ID = 1;

/** What the permission answered last time, so a session does not ask per set. */
let allowed: boolean | undefined;

/**
 * Asks once, in context: the first rest of the app's life, with the timer
 * already counting down behind the prompt so the reason is on screen.
 *
 * A denial is a supported state and not an error — the bar keeps running
 * silently — so this answers with a boolean rather than throwing. Android 12
 * and older grant it without a prompt; on 13+ the plugin's own manifest carries
 * `POST_NOTIFICATIONS` and this is what triggers the dialog.
 */
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
		// The web, or a shell without the plugin. Silent, and remembered so the
		// question is not re-asked once per set.
		allowed = false;
	}

	return allowed;
}

/**
 * Puts the end of this rest in the OS's hands.
 *
 * `allowWhileIdle` is what makes it exact rather than batched into Doze's next
 * maintenance window — a rest timer that fires whenever Android next feels like
 * it is not a rest timer. It needs `SCHEDULE_EXACT_ALARM` in the app manifest,
 * which is why that permission is declared there.
 *
 * A time already past is not scheduled: the plugin fires those immediately, and
 * a buzz for a rest that ended while the app was being resumed is a lie about
 * when it ended.
 */
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
		// Nothing to surface: the bar on screen is the primary reading, and this
		// is the copy of it that survives a dark screen.
	}
}

/**
 * Unschedules unconditionally — no check on whether one is pending. A
 * notification that fires for a workout which ended ten minutes ago is the
 * failure worth spending the redundant calls on.
 */
export async function cancelRestEnd(): Promise<void> {
	try {
		await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
	} catch {
		// The web, or nothing pending. Either way there is nothing to do.
	}
}
