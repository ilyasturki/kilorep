<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { parseEntry, settle } from '$lib/domain/workout';
	import { tapTick } from '$lib/ui/feedback';
	import { easeFling, landing, STALE_MS } from '$lib/ui/fling';
	import { keyboardUp, visiblePane, watchVisiblePane } from '$lib/ui/keyboard';

	type Props = {
		value: number;
		typed: string | null;
		label: string;
		step: number;
		major?: number;
		min: number;
		max: number;
		// How a rung reads, and how the draft over it is read back. A plain number by default;
		// a field that counts in something else — a clock, say — says so here.
		format?: (value: number) => string;
		parse?: (raw: string) => number | null;
		onscrub: (value: number) => void;
		onpick: (value: number) => void;
		// Android eats the OS back gesture that drops the keyboard, so keyboard-down is the
		// only dismissal signal there is.
		ondismiss: () => void;
	};

	let {
		value,
		typed,
		label,
		step,
		major: majorEvery = 4,
		min,
		max,
		format = String,
		parse = parseEntry,
		onscrub,
		onpick,
		ondismiss
	}: Props = $props();

	const PITCH = 52;

	// 0.6, not 0.5: at exactly half a pitch the departing rung and the draft overlap for a frame.
	const UNDER_BAND = 0.6;

	// One buzz per detent turns into a rattle under a throw; what reads as detents passing is a
	// rate, not a count.
	const TICK_GAP = 40;

	// The keys are still on their way when the panel mounts, so the pane it would dock against is
	// the keyboardless one — a sheet over the whole screen that then jumps twice as the real pane
	// arrives. Wait for the pane to hold still, and paint already in place.
	const PANE_QUIET = 100;

	// A coarse pointer with no soft keyboard — a tablet with keys of its own — would otherwise
	// wait on one that is never coming.
	const PANE_GRACE = 700;

	const lo = $derived(Math.ceil(min / step));
	const hi = $derived(Math.floor(max / step));

	const clampIndex = (i: number) => Math.min(Math.max(i, lo), hi);
	const at = (i: number) => settle(i * step, min, max);

	// svelte-ignore state_referenced_locally
	let pos = $state(clampIndex(value / step));

	let pane = $state(visiblePane());

	// svelte-ignore state_referenced_locally
	let sawKeyboard = keyboardUp(pane);

	// svelte-ignore state_referenced_locally
	let docked = $state(sawKeyboard);

	// The panel is the pane, and the rungs are laid out inside it: measuring the box instead
	// costs a first frame at zero height, with every rung piled at the top edge.
	const height = $derived(pane.height);

	$effect(() => {
		let quiet: ReturnType<typeof setTimeout> | undefined;

		const grace = setTimeout(() => (docked = true), PANE_GRACE);

		const stop = watchVisiblePane((next) => {
			pane = next;

			if (keyboardUp(next)) {
				sawKeyboard = true;
				clearTimeout(quiet);
				quiet = setTimeout(() => (docked = true), PANE_QUIET);
			} else if (sawKeyboard) {
				ondismiss();
			}
		});

		return () => {
			clearTimeout(grace);
			clearTimeout(quiet);
			stop();
		};
	});

	const draft = $derived(typed === null ? null : typed.trim());

	$effect(() => {
		const parsed = draft === null ? null : parse(draft);

		if (parsed !== null) {
			pos = clampIndex(parsed / step);
		}
	});

	type Rung = { i: number; y: number; near: boolean; major: boolean; mark: number; text: string };

	const rungs = $derived.by<Rung[]>(() => {
		const reach = Math.ceil(height / 2 / PITCH) + 1;
		const centre = Math.round(pos);
		const out: Rung[] = [];

		for (let i = Math.floor(pos - reach); i <= Math.ceil(pos + reach); i++) {
			if (i < lo || i > hi) {
				continue;
			}

			if (draft !== null && Math.abs(i - pos) < UNDER_BAND) {
				continue;
			}

			const major = i % majorEvery === 0;

			out.push({
				i,
				y: height / 2 - (i - pos) * PITCH,
				near: i === centre,
				major,
				mark: major ? 26 : 14,
				text: format(at(i))
			});
		}

		return out;
	});

	let ticked = 0;

	function settleTo(next: number) {
		const chosen = at(clampIndex(next));

		if (chosen !== value) {
			const now = performance.now();

			if (now - ticked >= TICK_GAP) {
				ticked = now;
				tapTick();
			}

			onscrub(chosen);
		}

		return chosen;
	}

	let flight: number | undefined;

	function halt() {
		if (flight !== undefined) {
			cancelAnimationFrame(flight);
			flight = undefined;
		}
	}

	$effect(() => halt);

	function letGo(speed: number) {
		halt();

		const still = prefersReducedMotion.current;
		const { to, ms } = landing(pos, still ? 0 : speed, PITCH, lo, hi);

		if (ms === 0 || still) {
			pos = to;
			settleTo(to);

			return;
		}

		const from = pos;
		const span = to - from;
		const start = performance.now();

		function frame(now: number): void {
			const t = Math.min(1, (now - start) / ms);

			pos = from + span * easeFling(t);
			settleTo(Math.round(pos));

			if (t < 1) {
				flight = requestAnimationFrame(frame);

				return;
			}

			flight = undefined;
			pos = to;
			settleTo(to);
		}

		flight = requestAnimationFrame(frame);
	}

	let drag: { y: number; moved: number; at: number; seen: number; speed: number } | null = null;

	function grab(event: PointerEvent & { currentTarget: HTMLElement }) {
		// A press on a non-focusable box blurs the focused field, dropping the keyboard and
		// closing the panel on the first frame of every drag.
		event.preventDefault();

		// A throw is only ever in flight until the next thumb lands on it.
		halt();

		event.currentTarget.setPointerCapture(event.pointerId);
		drag = { y: event.clientY, moved: 0, at: event.timeStamp, seen: event.timeStamp, speed: 0 };
	}

	function move(event: PointerEvent) {
		if (drag === null) {
			return;
		}

		const dy = event.clientY - drag.y;
		const dt = event.timeStamp - drag.seen;

		drag.y = event.clientY;
		drag.moved += Math.abs(dy);

		if (dt > 0) {
			const rate = dy / dt;

			// A gap that long is a finger that stopped: average from there rather than through it.
			drag.speed = dt > STALE_MS ? rate : drag.speed * 0.35 + rate * 0.65;
			drag.seen = event.timeStamp;
		}

		pos = clampIndex(pos + dy / PITCH);
		settleTo(Math.round(pos));
	}

	function release(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (drag === null) {
			return;
		}

		const tapped = drag.moved < 8 && event.timeStamp - drag.at < 500;

		// A finger that came to rest before lifting placed the ruler; it did not throw it.
		const speed = event.timeStamp - drag.seen > STALE_MS ? 0 : drag.speed;

		drag = null;

		if (!tapped) {
			letGo(speed);

			return;
		}

		const rect = event.currentTarget.getBoundingClientRect();
		const i = clampIndex(Math.round(pos - (event.clientY - rect.top - rect.height / 2) / PITCH));

		pos = i;
		tapTick();
		onpick(at(i));
	}
</script>

<!-- Inside the field's own tree, which is why the ladder cannot be opened from a sheet: the pane
     is `fixed`, a sheet is translated, and a translated ancestor becomes the containing block for
     everything fixed under it — the ladder would dock to the panel instead of the screen. Sending
     it out to the body fixes the geometry and loses the gesture: to a modal, a thumb on a sibling
     of its panel is a thumb outside it, and the first frame of the drag closes the sheet. Fields
     in sheets keep their arms and their keyboard; `RestDurationField` takes `ruler={false}`. -->
{#if docked}
	<div
		class="fixed inset-x-0 z-50 overflow-hidden bg-surface select-none"
		style="top:{pane.top}px;height:{pane.height}px"
		role="group"
		aria-label="Pick a {label}"
	>
		<div
			onpointerdown={grab}
			onpointermove={move}
			onpointerup={release}
			onpointercancel={() => {
				drag = null;
				letGo(0);
			}}
			class="absolute inset-0 touch-none"
			role="presentation"
		>
			<!-- The thumb scrubs anywhere on the pane, but the ladder itself keeps a phone's
			     column. Spanning a landscape tablet strands each rung's ticks against the screen
			     edges, a hand's width from the number they mark, and the band they sit in stops
			     reading as one row. -->
			<div class="absolute inset-y-0 left-1/2 w-full max-w-xl -translate-x-1/2">
				<div
					class="pointer-events-none absolute inset-x-2 top-1/2 -mt-7 h-14 rounded-[0.875rem]
						bg-accent-soft"
					aria-hidden="true"
				>
					<span class="absolute top-1/2 left-2.5 -mt-[11px] h-[22px] w-1 rounded-sm bg-accent-text"
					></span>
					<span class="absolute top-1/2 right-2.5 -mt-[11px] h-[22px] w-1 rounded-sm bg-accent-text"
					></span>
				</div>

				{#each rungs as rung (rung.i)}
					<div
						class={[
							'absolute inset-x-0 flex -translate-y-1/2 items-center justify-center',
							'tracking-numeral whitespace-nowrap',
							rung.near
								? 'text-3xl font-extrabold text-accent-text'
								: 'text-xl font-bold text-ink-muted'
						]}
						style="top:{rung.y}px"
					>
						{#if !rung.near}
							<span
								class="absolute left-3.5 h-0.5 rounded-[1px] {rung.major
									? 'bg-ink-faint'
									: 'bg-line'}"
								style="width:{rung.mark}px"
							></span>
							<span
								class="absolute right-3.5 h-0.5 rounded-[1px] {rung.major
									? 'bg-ink-faint'
									: 'bg-line'}"
								style="width:{rung.mark}px"
							></span>
						{/if}
						<span>{rung.text}</span>
					</div>
				{/each}

				{#if draft !== null}
					<div
						class="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center
						text-3xl font-extrabold tracking-numeral whitespace-nowrap text-accent-text"
					>
						{draft}<i class="caret-band" aria-hidden="true"></i>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
