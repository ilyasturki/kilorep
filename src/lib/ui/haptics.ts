import { ImpactStyle, Haptics } from '@capacitor/haptics';

async function buzz(style: ImpactStyle): Promise<void> {
	try {
		await Haptics.impact({ style });
	} catch {
		// No haptics engine, or the web. Never worth surfacing.
	}
}

export function tapCommit(): void {
	void buzz(ImpactStyle.Medium);
}

export function tapLift(): void {
	void buzz(ImpactStyle.Light);
}

/**
 * Rest is up. The heaviest of the three, because it is the only one the app
 * initiates rather than answers — every other buzz here confirms something a
 * thumb just did, and this one arrives at a phone lying on a bench.
 */
export function tapAlarm(): void {
	void buzz(ImpactStyle.Heavy);
}
