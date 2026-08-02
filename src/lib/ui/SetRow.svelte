<script lang="ts" module>
	import type { SetStatus } from '$lib/ui/SetMark.svelte';

	/**
	 * One set in the list. Four states, one fixed numeral grid, one right slot.
	 *
	 * Weight and reps sit on the same three-column grid in every status, so the
	 * digits line up vertically down the whole list and the eye can scan one
	 * column instead of hunting. The grid is in rem, not px, so it grows with
	 * the OS text size along with everything else.
	 *
	 * Options are reached by long-press on a touch device, by a visible dots
	 * button when there is a mouse, and by right-click either way. Same handler,
	 * and a hybrid device gets all three rather than being made to guess.
	 */
	const styles: Record<SetStatus, { shell: string; numerals: string; times: string }> = {
		warmup: {
			shell: 'min-h-14 rounded-xl bg-surface border border-dashed border-line opacity-[0.72]',
			numerals: 'text-lg text-ink-muted',
			times: 'text-md'
		},
		done: {
			shell: 'min-h-row rounded-xl bg-surface border border-line-soft',
			numerals: 'text-xl text-ink',
			times: 'text-base'
		},
		active: {
			// `card-active` in app.css, shared with the editor this row expands
			// into — including the reason it is accent-text and not accent.
			shell: 'card-active min-h-24',
			numerals: 'text-3xl tracking-numeral text-ink',
			times: 'text-lg'
		},
		pending: {
			shell: 'min-h-row rounded-xl border border-dashed border-line',
			numerals: 'text-xl text-ink-faint',
			times: 'text-base'
		}
	};

	const numeralGrid =
		'grid grid-cols-[5rem_1.375rem_2.5rem] items-baseline justify-start font-extrabold ' +
		'@md:grid-cols-[6.5rem_1.625rem_3.5rem]';

	const show = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(n));
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import SetMark from '$lib/ui/SetMark.svelte';
	import More from '$lib/ui/icons/More.svelte';

	type Props = {
		status: SetStatus;
		index?: number;
		weight?: number | null;
		reps?: number | null;
		/** One slot, one fact: `RPE 8`, `82.5 × 7`, `NOW`, `note`. */
		right?: Snippet;
		onselect?: () => void;
		onoptions?: () => void;
		class?: ClassValue;
	};

	let { status, index, weight, reps, right, onselect, onoptions, class: klass }: Props = $props();

	const style = $derived(styles[status]);

	/**
	 * Whether the row responds to a tap, and therefore whether it says so.
	 *
	 * Read off the prop rather than the status, the same test `ListRow` makes:
	 * a pending row and a logged one are both selectable — tapping a logged set
	 * reopens it for editing — and a warmup is neither, because `ExerciseBlock`
	 * hands it no `onselect`. A hover that promised a tap the row then refused
	 * would be the surprise DESIGN.md rules out.
	 */
	const interactive = $derived(Boolean(onselect));

	// Long-press. The timer is cleared by any pointer exit, and a completed press
	// swallows the click that follows it so options and select never both fire.
	// Neither of these is `$state`: both are written and read inside handlers and
	// nothing renders from them.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let fired = false;

	function pressStart() {
		if (!onoptions) {
			return;
		}
		fired = false;
		timer = setTimeout(() => {
			fired = true;
			onoptions?.();
		}, 500);
	}

	function pressEnd() {
		clearTimeout(timer);
	}

	function select() {
		if (fired) {
			fired = false;
			return;
		}
		onselect?.();
	}
</script>

<div
	class={[
		'@container relative grid grid-cols-[1fr_auto] items-center overflow-hidden',
		style.shell,
		// On the shell and not on the button inside it: the ⋯ is a sibling holding
		// the right edge, so a tint on the button alone would light two thirds of
		// a row. `:active` still fires here when the press lands on that button.
		interactive && 'hover:bg-surface-2 active:bg-surface-2',
		interactive && 'pointer-fine:transition-[background-color] pointer-fine:duration-100',
		klass
	]}
>
	{#if status === 'active'}
		<div class="absolute inset-y-0 left-0 w-1.5 bg-accent-text" aria-hidden="true"></div>
	{/if}

	<button
		type="button"
		onclick={select}
		onpointerdown={pressStart}
		onpointerup={pressEnd}
		onpointerleave={pressEnd}
		onpointercancel={pressEnd}
		oncontextmenu={(e) => {
			if (!onoptions) return;
			e.preventDefault();
			onoptions();
		}}
		class="grid h-full w-full grid-cols-[2rem_1fr_auto] items-center gap-3 py-2 pr-3
			pl-4 text-left focus-ring-inset"
	>
		<SetMark {status} {index} />

		<div class="{numeralGrid} {style.numerals}">
			<span class="text-right">{show(weight)}</span>
			<span class="text-center font-bold text-ink-faint {style.times}">×</span>
			<span class="text-right">{show(reps)}</span>
		</div>

		<div class="text-sm font-bold text-ink-faint">
			{@render right?.()}
		</div>
	</button>

	{#if onoptions}
		<!-- `sunken`, not `surface-2`: the shell already hovers `surface-2`, so a
		     button hovering the same swatch inside it never changed colour at all
		     and read as part of the row rather than as its own target. The well
		     is a visible step past the lit row in both themes. -->
		<button
			type="button"
			aria-label="Set options"
			onclick={onoptions}
			class="mr-2 hidden size-9 shrink-0 place-items-center rounded-lg text-lg text-ink-faint
				focus-ring hover:bg-sunken hover:text-ink-muted pointer-fine:grid
				pointer-fine:transition-[background-color,color] pointer-fine:duration-100"
		>
			<More size={20} />
		</button>
	{/if}
</div>
