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

class RestTimer {
	public endsAt: number | null = $state(null);

	public seconds: number = $state(0);

	public exerciseId: string | null = $state(null);

	public muted: boolean = $state(false);

	public now: number = $state(Date.now());

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
		this.endsAt = null;
		this.exerciseId = null;
		this.seconds = 0;
		this.#rang = false;
		this.#dismissed = null;

		void cancelRestEnd();
		void this.#persist();
	}

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

	public undo(at: number = Date.now()): void {
		const dismissed = this.#dismissed;

		if (dismissed === null) {
			return;
		}

		this.#dismissed = null;
		this.start(dismissed, at);
	}

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

		// Never buzz on resume: the OS notification covered any end passed while away.
		this.#rang = true;
	}

	public tick(now: number): void {
		this.now = now;

		if (this.#dismissed !== null && now - this.#dismissedAt >= REST_UNDO_MS) {
			this.#dismissed = null;
		}

		if (this.endsAt === null || this.#rang || now < this.endsAt) {
			return;
		}

		this.#rang = true;

		// Past 1500ms the tick slept through the zero and the notification announced it.
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

	async #persist(): Promise<void> {
		const rest = this.snapshot;
		const { muted } = this;
		const store = await getStore();

		await store.saveRest(rest, muted);
	}
}

export const restTimer = new RestTimer();
