import { MAX_REST_SECONDS, nudgedEnd, restLabel, restProgress } from '$lib/domain/rest';
import type { RestStart } from '$lib/domain/rest';
import { cancelRestEnd, scheduleRestEnd } from '$lib/notify/rest';
import { getStore } from '$lib/store/store';
import type { RestSnapshot } from '$lib/store/store';
import { tapAlarm } from '$lib/ui/feedback';

class RestTimer {
	public endsAt: number | null = $state(null);

	public seconds: number = $state(0);

	public exerciseId: string | null = $state(null);

	public name: string | null = $state(null);

	public muted: boolean = $state(false);

	public now: number = $state(Date.now());

	// Kept whole, end and all: bringing it back resumes the rest that was running rather than
	// starting a fresh one late.
	public dismissed: RestSnapshot | null = $state.raw(null);

	#rang = false;

	public get running(): boolean {
		return this.endsAt !== null;
	}

	/** Whether the bar owes the rest a face: running, waiting to be brought back, or off. */
	public get showing(): boolean {
		return this.running || this.dismissed !== null || this.muted;
	}

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

	public get snapshot(): RestSnapshot | null {
		if (this.endsAt === null || this.exerciseId === null) {
			return null;
		}

		const rest: RestSnapshot = {
			endsAt: this.endsAt,
			seconds: this.seconds,
			exerciseId: this.exerciseId
		};

		if (this.name !== null) {
			rest.name = this.name;
		}

		return rest;
	}

	public start(rest: RestStart, at: number = Date.now()): void {
		const next: RestSnapshot = {
			endsAt: at + rest.seconds * 1000,
			seconds: rest.seconds,
			exerciseId: rest.exerciseId
		};

		if (rest.name !== undefined) {
			next.name = rest.name;
		}

		this.now = at;

		// Muted, the rest is still earned and set aside, so unmuting shows the one that would be
		// running now rather than one from before the mute.
		if (this.muted) {
			this.#show(null);
			this.dismissed = next;

			void cancelRestEnd();
			void this.#persist();

			return;
		}

		this.dismissed = null;
		this.#show(next);
		this.#rang = false;

		this.#announce();
		void this.#persist();
	}

	public nudge(bySeconds: number, at: number = Date.now()): void {
		if (this.endsAt === null) {
			return;
		}

		this.endsAt = nudgedEnd(this.endsAt, bySeconds, at);
		this.now = at;

		this.seconds = Math.min(MAX_REST_SECONDS, Math.max(1, this.seconds + bySeconds));

		this.#rang = this.endsAt <= at;

		this.#announce();
		void this.#persist();
	}

	public clear(): void {
		this.#show(null);
		this.dismissed = null;

		void cancelRestEnd();
		void this.#persist();
	}

	public skip(at: number = Date.now()): void {
		const running = this.snapshot;

		if (running === null) {
			return;
		}

		this.#show(null);
		this.dismissed = running;
		this.now = at;

		void cancelRestEnd();
		void this.#persist();
	}

	public bringBack(at: number = Date.now()): void {
		const dismissed = this.dismissed;

		if (dismissed === null || this.muted) {
			return;
		}

		this.dismissed = null;
		this.#show(dismissed);
		this.now = at;

		// An end already behind us rang while it was away, or was never wanted.
		this.#rang = dismissed.endsAt <= at;

		this.#announce();
		void this.#persist();
	}

	public mute(at: number = Date.now()): void {
		const running = this.snapshot;

		this.muted = true;
		this.now = at;

		if (running !== null) {
			this.#show(null);
			this.dismissed = running;
		}

		void cancelRestEnd();
		void this.#persist();
	}

	public unmute(at: number = Date.now()): void {
		this.muted = false;

		if (this.dismissed !== null) {
			this.bringBack(at);

			return;
		}

		void this.#persist();
	}

	public reset(): void {
		this.muted = false;
		this.#show(null);
		this.dismissed = null;

		void cancelRestEnd();
	}

	public resume(rest: RestSnapshot | null, muted: boolean, dismissed: RestSnapshot | null): void {
		this.muted = muted;
		this.now = Date.now();
		this.dismissed = dismissed;
		this.#show(rest);

		// Never buzz on resume: the OS notification covered any end passed while away.
		this.#rang = true;
	}

	public tick(now: number): void {
		this.now = now;

		if (this.endsAt === null || this.#rang || now < this.endsAt) {
			return;
		}

		this.#rang = true;

		// Past 1500ms the tick slept through the zero and the notification announced it.
		if (now - this.endsAt < 1500) {
			tapAlarm();
		}
	}

	#show(rest: RestSnapshot | null): void {
		this.endsAt = rest?.endsAt ?? null;
		this.seconds = rest?.seconds ?? 0;
		this.exerciseId = rest?.exerciseId ?? null;
		this.name = rest?.name ?? null;
		this.#rang = false;
	}

	#announce(): void {
		if (this.endsAt === null) {
			return;
		}

		// A cut to zero leaves the one scheduled for the old end pending, so it goes too.
		if (this.endsAt <= this.now) {
			void cancelRestEnd();

			return;
		}

		const { name } = this;

		void scheduleRestEnd(this.endsAt, name === null ? 'Next set up.' : `${name}, next set up.`);
	}

	async #persist(): Promise<void> {
		const { snapshot: rest, muted, dismissed } = this;
		const store = await getStore();

		await store.saveRest({ rest, muted, dismissed });
	}
}

export const restTimer = new RestTimer();
