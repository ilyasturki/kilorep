import { ImpactStyle, Haptics } from '@capacitor/haptics';

/**
 * Swallows every way a vibration can fail to happen: no vibrator, no
 * permission, a browser that never implemented `navigator.vibrate`, a desktop.
 * None is worth a line in the console on every logged set, and none changes
 * what the screen does next.
 */
async function buzz(style: ImpactStyle): Promise<void> {
	try {
		await Haptics.impact({ style });
	} catch {
		// Deliberately silent — see above.
	}
}

/**
 * The two physical acknowledgements the app makes, and the rule that keeps
 * there being two.
 *
 * A buzz is spent on a gesture the screen cannot confirm on its own. Logging a
 * set is one: it is the claim the whole app exists to record, and it happens
 * with a phone at arm's length on a bench. Lifting a row to reorder it is the
 * other, and only because a long-press has nothing else to say it registered —
 * a hold that has not yet moved anything looks identical to a hold that missed.
 *
 * Nothing else qualifies. Crossing a row mid-drag is already answered by the
 * list rearranging under the finger, and buzzing each one would fire ten times
 * across an eight-exercise session.
 *
 * They live at the UI edge rather than in `session.svelte.ts`, and that is the
 * point: committing a set is a domain event, feeling it is a presentation
 * detail, and the store stays free of the platform. The same rule keeps
 * `$lib/domain` free of Svelte — one layer out, same reasoning.
 *
 * Fire-and-forget. The plugin's promise resolves after the vibration is
 * scheduled, and nothing on screen waits on it — awaiting here would put a
 * native round-trip inside the tap that DESIGN.md insists is instant.
 */
export function tapCommit(): void {
	void buzz(ImpactStyle.Medium);
}

/** Lighter than the commit: picking a row up is not an assertion about a lift. */
export function tapLift(): void {
	void buzz(ImpactStyle.Light);
}
