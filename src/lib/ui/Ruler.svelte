<script lang="ts">
	import { parseEntry, settle } from '$lib/domain/workout';
	import { tapLift } from '$lib/ui/haptics';
	import { keyboardUp, visiblePane, watchVisiblePane } from '$lib/ui/keyboard';

	type Props = {
		/** Where the strip sits when it opens, and nothing after that: the ruler
		 * owns its own position for the rest of its life. */
		value: number;
		/** What is being typed on the real keyboard, or `null` when nothing is.
		 * The band shows it, because the field behind this panel cannot. */
		typed: string | null;
		label: string;
		step: number;
		min: number;
		max: number;
		/** A detent crossed under the thumb. Fires per step, like a held arm. */
		onscrub: (value: number) => void;
		/** A number tapped on the strip: take it and finish. */
		onpick: (value: number) => void;
		/** The keyboard went away without us — the OS back gesture eats the press
		 * before the app ever sees it, so this is the only word we get. */
		ondismiss: () => void;
	};

	let { value, typed, label, step, min, max, onscrub, onpick, ondismiss }: Props = $props();

	/* 52px per detent. The trade is pure travel against precision — vertical
	   stacking means the labels never collide, so pitch buys nothing but reach —
	   and 52 puts nine steps in a full-height drag on a phone while leaving each
	   number a slab a thumb can aim at. */
	const PITCH = 52;

	/* The band is 56 tall and the rungs are laid out from their centres, so a rung
	   is "under" the band while it is within a bit over half a pitch of it. 0.6
	   rather than 0.5: at exactly half the departing rung and the draft are drawn
	   in the same place for one frame. */
	const UNDER_BAND = 0.6;

	const lo = $derived(Math.ceil(min / step));
	const hi = $derived(Math.floor(max / step));

	const clampIndex = (i: number) => Math.min(Math.max(i, lo), hi);
	const at = (i: number) => settle(i * step, min, max);

	/* The continuous index under the band. Read from `value` once, at open —
	   after that the strip is the source of truth and `value` is an echo of it. */
	// svelte-ignore state_referenced_locally
	let pos = $state(clampIndex(value / step));

	let height = $state(0);
	let pane = $state(visiblePane());

	/* Seeded rather than started at `false`: moving from the weight field to the
	   reps field beside it opens a second ruler under a keyboard that never went
	   down, so no resize fires and nothing would ever set this. */
	// svelte-ignore state_referenced_locally
	let sawKeyboard = keyboardUp(pane);

	$effect(() =>
		watchVisiblePane((next) => {
			pane = next;

			if (keyboardUp(next)) {
				sawKeyboard = true;
			} else if (sawKeyboard) {
				ondismiss();
			}
		})
	);

	const draft = $derived(typed === null ? null : typed.trim());

	$effect(() => {
		const parsed = draft === null ? null : parseEntry(draft);

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

			// While something is being typed the band belongs to the draft, so the
			// rung that would sit under it stands down rather than showing through.
			if (draft !== null && Math.abs(i - pos) < UNDER_BAND) {
				continue;
			}

			const major = i % 4 === 0;

			out.push({
				i,
				y: height / 2 - (i - pos) * PITCH,
				near: i === centre,
				major,
				mark: major ? 26 : 14,
				text: String(at(i))
			});
		}

		return out;
	});

	function settleTo(next: number) {
		const chosen = at(clampIndex(next));

		if (chosen !== value) {
			tapLift();
			onscrub(chosen);
		}

		return chosen;
	}

	let drag: { y: number; moved: number; at: number } | null = null;

	function grab(event: PointerEvent & { currentTarget: HTMLElement }) {
		// The field behind this panel is focused and has to stay that way — the
		// keyboard is the other half of the editor. A press on a non-focusable box
		// blurs it by default, which would drop the keyboard and close the panel
		// on the first frame of every drag.
		event.preventDefault();

		event.currentTarget.setPointerCapture(event.pointerId);
		drag = { y: event.clientY, moved: 0, at: event.timeStamp };
	}

	function move(event: PointerEvent) {
		if (drag === null) {
			return;
		}

		const dy = event.clientY - drag.y;
		drag.y = event.clientY;
		drag.moved += Math.abs(dy);

		// Pull down for more. The strip moves with the thumb and the numbers rise
		// up the column past a needle that never moves, which is what a physical
		// ruler does; mapping it the other way is a scrollbar's convention, and
		// there is no scrollbar here to borrow it from.
		pos = clampIndex(pos + dy / PITCH);
		settleTo(Math.round(pos));
	}

	function release(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (drag === null) {
			return;
		}

		const tapped = drag.moved < 8 && event.timeStamp - drag.at < 500;
		drag = null;

		if (!tapped) {
			pos = Math.round(pos);

			return;
		}

		const rect = event.currentTarget.getBoundingClientRect();
		const i = clampIndex(Math.round(pos - (event.clientY - rect.top - rect.height / 2) / PITCH));

		pos = i;
		tapLift();
		onpick(at(i));
	}
</script>

<!-- Everything above the keyboard, and nothing left over. The set card and the
     page behind it are covered outright — which is what buys the strip its full
     height, and why the band has to carry the value: nothing else on screen is
     still showing it. -->
<div
	class="fixed inset-x-0 z-50 overflow-hidden bg-surface select-none"
	style="top:{pane.top}px;height:{pane.height}px"
	role="group"
	aria-label="Pick a {label}"
>
	<!-- A filled band behind the number rather than a line across it: a rule
	     through a numeral reads as a strikethrough, which is the one thing the
	     selection may never look like. The grips sit at the ends, where nothing
	     is written. -->
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

	<div
		bind:clientHeight={height}
		onpointerdown={grab}
		onpointermove={move}
		onpointerup={release}
		onpointercancel={() => {
			drag = null;
			pos = Math.round(pos);
		}}
		class="absolute inset-0 touch-none"
		role="presentation"
	>
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
						class="absolute left-3.5 h-0.5 rounded-[1px] {rung.major ? 'bg-ink-faint' : 'bg-line'}"
						style="width:{rung.mark}px"
					></span>
					<span
						class="absolute right-3.5 h-0.5 rounded-[1px] {rung.major ? 'bg-ink-faint' : 'bg-line'}"
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
