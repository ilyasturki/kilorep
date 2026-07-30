import { ImpactStyle, Haptics } from '@capacitor/haptics';

/**
 * Swallows every way a vibration can fail to happen: no vibrator, no
 * permission, a browser that never implemented `navigator.vibrate`, a desktop.
 * None is worth a line in the console on every logged set, and none changes
 * what the screen does next.
 */
async function buzz(): Promise<void> {
	try {
		await Haptics.impact({ style: ImpactStyle.Medium });
	} catch {
		// Deliberately silent — see above.
	}
}

/**
 * The one physical acknowledgement the app makes.
 *
 * It lives at the UI edge rather than in `session.svelte.ts`, and that is the
 * point: committing a set is a domain event, feeling it is a presentation
 * detail, and the store stays free of the platform. The same rule keeps
 * `$lib/domain` free of Svelte — one layer out, same reasoning.
 *
 * Fire-and-forget. The plugin's promise resolves after the vibration is
 * scheduled, and nothing on screen waits on it — awaiting here would put a
 * native round-trip inside the tap that DESIGN.md insists is instant.
 */
export function tapCommit(): void {
	void buzz();
}
