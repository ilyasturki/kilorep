import { catalogById } from '$lib/catalog';
import {
	MAX_REST_SECONDS,
	REST_UNDO_MS,
	nudgedEnd,
	restLabel,
	restProgress
} from '$lib/domain/rest';
import type { RestStart } from '$lib/domain/rest';
import { cancelRestEnd, scheduleRestEnd } from '$lib/notify/rest';
import { getStore } from '$lib/store/store';
import type { RestSnapshot } from '$lib/store/store';
import { tapAlarm } from '$lib/ui/haptics';

/**
 * The rest that is running, if one is.
 *
 * A holder rather than page state, because the bar outlives every screen: it is
 * docked in the tab layout and keeps running while the user walks to Exercises
 * to look something up. The same reason `activeWorkout` is a holder.
 */
class RestTimer {
	public endsAt: number | null = $state(null);

	public seconds: number = $state(0);

	public exerciseId: string | null = $state(null);

	/** Silenced for the remainder of this session. Dies with it, per PRODUCT.md. */
	public muted: boolean = $state(false);

	/** Pushed in by the bar's interval; the only clock this module has. */
	public now: number = $state(Date.now());

	/**
	 * The rest SKIP threw away, for as long as it can be asked back.
	 *
	 * In memory and nowhere else: it never reaches the snapshot, so a reload or
	 * a long walk away from the phone lands on a session with no rest running,
	 * which is what a skip meant when it was pressed. Only `skip()` fills it —
	 * `clear()` is also what a warmup or a never-rest exercise gets on commit,
	 * and an undo offer arriving mid-log is the friction the strip exists to
	 * avoid.
	 */
	#dismissed: RestStart | null = $state(null);

	#dismissedAt = 0;

	#rang = false;

	public get running(): boolean {
		return this.endsAt !== null;
	}

	public get undoing(): boolean {
		return this.#dismissed !== null;
	}

	public get dismissedName(): string | null {
		const id = this.#dismissed?.exerciseId;

		return id === undefined ? null : (catalogById[id]?.name ?? null);
	}

	/** Negative is overtime, and overtime is a state, not an error. */
	public get remaining(): number {
		return this.endsAt === null ? 0 : this.endsAt - this.now;
	}

	public get overtime(): boolean {
		return this.running && this.remaining <= 0;
	}

	public get label(): string {
		return restLabel(this.remaining);
	}

	public get progress(): number {
		return this.endsAt === null ? 0 : restProgress(this.endsAt, this.seconds, this.now);
	}

	public get exerciseName(): string | null {
		return this.exerciseId === null ? null : (catalogById[this.exerciseId]?.name ?? null);
	}

	public get snapshot(): RestSnapshot | null {
		return this.endsAt === null || this.exerciseId === null
			? null
			: { endsAt: this.endsAt, seconds: this.seconds, exerciseId: this.exerciseId };
	}

	/**
	 * Starts one, replacing whatever was running.
	 *
	 * Replacing rather than refusing: the previous rest is over by definition,
	 * because the thing that starts this one is another set having been logged.
	 * The notification is rescheduled under the same id, which is what stops the
	 * old end time from firing behind the new one.
	 */
	public start(rest: RestStart, at: number = Date.now()): void {
		if (this.muted) {
			return;
		}

		this.seconds = rest.seconds;
		this.exerciseId = rest.exerciseId;
		this.endsAt = at + rest.seconds * 1000;
		this.now = at;
		this.#rang = false;
		this.#dismissed = null;

		this.#announce();
		void this.#persist();
	}

	/**
	 * ±30s, this rest only. The default is never rewritten from here — an
	 * adjustment mid-session is a fact about this set, not a change of mind about
	 * the exercise, and a timer that silently taught itself from one bad set
	 * would be editing a preference nobody opened.
	 */
	public nudge(bySeconds: number, at: number = Date.now()): void {
		if (this.endsAt === null) {
			return;
		}

		this.endsAt = nudgedEnd(this.endsAt, bySeconds, at);
		this.now = at;

		// The track measures against the whole rest, so stretching one has to
		// stretch what it is measured against or the fill jumps backwards.
		this.seconds = Math.min(MAX_REST_SECONDS, Math.max(1, this.seconds + bySeconds));

		// A cut that lands in the past has already rung by arriving.
		this.#rang = this.endsAt <= at;

		this.#announce();
		void this.#persist();
	}

	public clear(): void {
		this.endsAt = null;
		this.exerciseId = null;
		this.seconds = 0;
		this.#rang = false;
		this.#dismissed = null;

		void cancelRestEnd();
		void this.#persist();
	}

	/**
	 * SKIP: the same clearing, plus five seconds in which it can be taken back.
	 *
	 * The offer is recorded after the clear, because clearing is what drops any
	 * older one and this is the new one.
	 */
	public skip(at: number = Date.now()): void {
		const dismissed = this.snapshot;

		this.clear();

		if (dismissed === null) {
			return;
		}

		this.#dismissed = { exerciseId: dismissed.exerciseId, seconds: dismissed.seconds };
		this.#dismissedAt = at;
		this.now = at;
	}

	/**
	 * The skip, taken back — as a fresh rest of the same length, not as the
	 * remainder that was thrown away. Standing up and sitting back down is the
	 * gesture, and the body that just got two seconds of it is owed the whole
	 * duration rather than whatever the clock had left when the thumb slipped.
	 */
	public undo(at: number = Date.now()): void {
		const dismissed = this.#dismissed;

		if (dismissed === null) {
			return;
		}

		this.#dismissed = null;
		this.start(dismissed, at);
	}

	/**
	 * No rest for the remainder of this session — the circuit day, without
	 * editing a single exercise. The flag is session state and not a preference:
	 * it rides the snapshot so a reload keeps it, and FINISH is what ends it.
	 */
	public mute(): void {
		this.muted = true;
		this.clear();
	}

	public reset(): void {
		this.muted = false;
		this.endsAt = null;
		this.exerciseId = null;
		this.seconds = 0;
		this.#rang = false;
		this.#dismissed = null;

		void cancelRestEnd();
	}

	public resume(rest: RestSnapshot | null, muted: boolean): void {
		this.muted = muted;
		this.now = Date.now();
		this.#dismissed = null;
		this.endsAt = rest?.endsAt ?? null;
		this.seconds = rest?.seconds ?? 0;
		this.exerciseId = rest?.exerciseId ?? null;

		// Never rings on the way in. Either the notification already fired while
		// the app was away, or it is still pending with the OS — a buzz here would
		// be a second announcement of a thing that has already been announced.
		this.#rang = true;
	}

	/**
	 * One tick, from whoever is on screen.
	 *
	 * The buzz is fired here rather than by a timeout, so it cannot happen while
	 * the app is backgrounded — that is the notification's job, and two alerts
	 * for one rest is worse than either. The freshness window is what keeps a
	 * resume from buzzing about a zero it slept through: a tick that arrives
	 * more than a second and a half late has missed the moment, and the
	 * notification covered it.
	 */
	public tick(now: number): void {
		this.now = now;

		// The undo window closes on the same clock the countdown runs on, so a
		// skip owes the app no timeout of its own.
		if (this.#dismissed !== null && now - this.#dismissedAt >= REST_UNDO_MS) {
			this.#dismissed = null;
		}

		if (this.endsAt === null || this.#rang || now < this.endsAt) {
			return;
		}

		this.#rang = true;

		if (now - this.endsAt < 1500) {
			tapAlarm();
		}
	}

	#announce(): void {
		if (this.endsAt === null) {
			return;
		}

		const name = this.exerciseName;

		void scheduleRestEnd(this.endsAt, name === null ? 'Next set up.' : `${name}, next set up.`);
	}

	/**
	 * The values are read off the holder before the store opens: by the time it
	 * has, a fast thumb may already have moved the timer on, and this write is
	 * meant to be of the state that asked for it.
	 */
	async #persist(): Promise<void> {
		const rest = this.snapshot;
		const { muted } = this;
		const store = await getStore();

		await store.saveRest(rest, muted);
	}
}

export const restTimer = new RestTimer();
