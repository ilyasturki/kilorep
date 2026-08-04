<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	/**
	 * A ± pair around a worded value, at row height.
	 *
	 * Not `StepperField`, and deliberately not a small mode of it. That control
	 * is 76px of typable number sized for a thumb at arm's length mid-set, with
	 * hold-to-repeat and an accent tint that means "you claimed this rather than
	 * recalled it". None of that is true here: the planning surface is read
	 * standing still, its numbers are small and land in two or three taps, and
	 * there is no recalled value for a tint to be measured against. What is
	 * shared is the silhouette — sunken well, fat arms on the ends, the value
	 * between them — and that is the part the eye recognises.
	 *
	 * `±` are characters, per the icons README: a glyph Nunito carries never
	 * becomes an SVG.
	 *
	 * An arm is a handler or it is null, rather than a handler plus a `disabled`
	 * flag: the caller already knows which presses mean something — a set count
	 * at one, a shared target over sets that disagree — and a null arm cannot
	 * fall out of step with the handler beside it. It stays on screen, greyed,
	 * because a control that vanishes at the edge of its range moves everything
	 * next to it.
	 */
	type Props = {
		/** Names the group and both arms: "Sets", "Rep target", "Set 2 reps". */
		label: string;
		/** What sits between the arms, already worded — "3 sets", "8 reps", "Open". */
		value: string;
		/** A target nothing has claimed yet, drawn like a placeholder rather than a number. */
		dim?: boolean;
		ondec: (() => void) | null;
		oninc: (() => void) | null;
		class?: ClassValue;
	};

	let { label, value, dim = false, ondec, oninc, class: klass }: Props = $props();

	const arm =
		'grid w-11 shrink-0 place-items-center text-xl font-semibold text-ink-muted ' +
		'focus-ring-inset select-none hover:bg-hover active:bg-surface-2 active:text-ink ' +
		'disabled:pointer-events-none disabled:opacity-40';
</script>

<div
	role="group"
	aria-label={label}
	class={['flex min-h-11 items-stretch rounded-xl bg-sunken', klass]}
>
	<button
		type="button"
		aria-label="Lower {label}"
		disabled={ondec === null}
		onclick={ondec ?? undefined}
		class="{arm} rounded-l-xl"
	>
		−
	</button>

	<span
		class={[
			'flex min-w-0 flex-1 items-center justify-center truncate px-1 text-md',
			dim ? 'font-bold text-ink-faint' : 'font-extrabold tracking-numeral text-ink'
		]}
	>
		{value}
	</span>

	<button
		type="button"
		aria-label="Raise {label}"
		disabled={oninc === null}
		onclick={oninc ?? undefined}
		class="{arm} rounded-r-xl"
	>
		+
	</button>
</div>
