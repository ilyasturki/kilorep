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
