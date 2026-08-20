import { registerPlugin } from '@capacitor/core';
import { ImpactStyle, Haptics } from '@capacitor/haptics';

// `hold` is Android's LONG_PRESS, `tick` its CLOCK_TICK, anything else CONFIRM.
// The names are the app's, the constants are the platform's; the mapping lives in
// FeedbackPlugin.java so the JS never has to know an SDK level.
type Kind = 'confirm' | 'hold' | 'tick';

type Feedback = {
	click: () => Promise<void>;
	haptic: (options: { kind: Kind }) => Promise<void>;
};

// `null` on the web, where the ternary lets the bundler drop the plugin entirely.
const feedback = import.meta.env.APP_BUILD ? registerPlugin<Feedback>('Feedback') : null;

async function knock(): Promise<void> {
	if (feedback === null) {
		return;
	}

	try {
		await feedback.click();
	} catch {
		// A stale APK against a newer bundle: silence, not a crash.
	}
}

async function buzz(kind: Kind): Promise<void> {
	if (feedback === null) {
		return;
	}

	try {
		await feedback.haptic({ kind });
	} catch {
		// As above.
	}
}

/**
 * The system click, played by every discrete tap. Android's own controls sound on
 * ACTION_UP and nothing else does, so scrubbing, dragging and scrolling stay quiet.
 * Wired once, in `wireNativeFeel` — not at the call sites.
 *
 * Never awaited: a tap must not wait on a bridge round-trip.
 */
export function tapClick(): void {
	void knock();
}

/** A set is logged, a dialog is confirmed: the one buzz that means "that landed". */
export function tapCommit(): void {
	void buzz('confirm');
}

/** A hold was recognised — a long press taken, a row lifted, a stepper let loose. */
export function tapHold(): void {
	void buzz('hold');
}

/** One notch of a stepper or a ruler. Cheap enough to fire at scrub rate. */
export function tapTick(): void {
	void buzz('tick');
}

async function shake(): Promise<void> {
	try {
		await Haptics.impact({ style: ImpactStyle.Heavy });
	} catch {
		// No vibrator, or the web.
	}
}

/**
 * The rest timer reaching zero. The only feedback still on the raw Vibrator: it is a
 * signal rather than an answer to a touch, and it has to arrive with the phone in a
 * pocket and touch vibration switched off.
 */
export function tapAlarm(): void {
	void shake();
}
