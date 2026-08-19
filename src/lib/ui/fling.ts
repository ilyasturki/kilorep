// A picker has to come to rest on a detent. Projecting the whole reach of the flick up front
// and rounding it there makes the throw one animation that ends where it belongs, rather than
// a glide with a snap bolted onto the end.

// The speed a flick sheds per millisecond, so a flick reaches `speed / DRAG` pixels.
const DRAG = 0.0045;

// Under this the finger placed the ruler rather than threw it, and only the detent is owed.
const THROW = 0.15;

const MS_PER_DETENT = 55;
const SHORTEST_MS = 140;
const LONGEST_MS = 650;

// A finger resting before it lifts is not a throw, however fast it was travelling before.
export const STALE_MS = 90;

export type Throw = { to: number; ms: number };

// `pos` and `to` count detents; `speed` is the finger in px/ms, positive downward.
export function landing(pos: number, speed: number, pitch: number, lo: number, hi: number): Throw {
	const reach = Math.abs(speed) < THROW ? 0 : speed / DRAG / pitch;
	const to = Math.min(Math.max(Math.round(pos + reach), lo), hi);
	const travel = Math.abs(to - pos);

	if (travel === 0) {
		return { to, ms: 0 };
	}

	return { to, ms: Math.min(LONGEST_MS, Math.max(SHORTEST_MS, travel * MS_PER_DETENT)) };
}

// Quintic out: the reach is spent early, so the long tail reads as coming to rest.
export function easeFling(t: number): number {
	return 1 - (1 - t) ** 5;
}
