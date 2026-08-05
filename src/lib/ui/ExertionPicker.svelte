<script lang="ts">
	import {
		EXERTION_RUNGS,
		exertionLabel,
		isExertion,
		scaleName,
		shownExertion,
		shownMax,
		shownMin,
		storedExertion,
		EXERTION_STEP
	} from '$lib/domain/exertion';
	import type { ExertionScale } from '$lib/domain/exertion';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import StepperField from '$lib/ui/StepperField.svelte';
	import More from '$lib/ui/icons/More.svelte';

	type Props = {
		value: number | null;
		scale: ExertionScale;
		onchange: (rpe: number | null) => void;
	};

	let { value, scale, onchange }: Props = $props();

	let mode = $state<'pill' | 'chips' | 'custom'>('pill');

	const rating = $derived(isExertion(value) ? value : null);

	const name = $derived(scaleName(scale));

	const shown = $derived(rating === null ? '–' : String(shownExertion(rating, scale)));
	const rated = $derived(exertionLabel(rating, scale));
	const pillLabel = $derived(
		rated === null ? `Rate this set in ${name}` : `Rated ${rated}, change it`
	);

	const rungs = $derived(EXERTION_RUNGS.map((rpe) => String(shownExertion(rpe, scale))));

	const selected = $derived(
		rating !== null && EXERTION_RUNGS.includes(rating) ? String(shownExertion(rating, scale)) : ''
	);

	/**
	 * `''` is the toggle group deselecting — re-tapping the lit chip — and it is
	 * the only way to clear a rating now that the `–` chip is gone. Eight items
	 * fill four columns exactly and nine did not, and the one this spends is the
	 * one the control already had a gesture for.
	 *
	 * The gap it leaves is honest and small: a custom value lights no chip, so
	 * clearing an RPE of 6 means opening ⋯ and emptying the field.
	 */
	function pick(next: string) {
		if (next === 'custom') {
			mode = 'custom';

			return;
		}

		onchange(next === '' ? null : storedExertion(Number(next), scale));
		mode = 'pill';
	}

	/**
	 * One height for both expanded states, so entering and leaving ⋯ does not
	 * move the commit button underneath — a button that shifts under a thumb
	 * already travelling toward it is the logging loop's own kind of bug.
	 *
	 * Under a thumb the chip grid is the tall one: two rows of `chip` plus the
	 * `gap-2` between them. Written as a calc off the token rather than as 112px,
	 * so it still fits when the OS text size grows the chips. At a fine pointer
	 * the chips are one 40px line and the stepper's 76px is the tall one instead,
	 * which is what `min-h-19` restores.
	 *
	 * Alignment is not in here, and deliberately: the chips are centred in the box
	 * so a desk's one-line row is never stretched into slabs, and the custom row
	 * fills it, because a stepper as tall as the box is a fatter target and
	 * nothing else is competing for the space. Two `align-items` utilities in one
	 * class list would be settled by Tailwind's own ordering rather than by which
	 * was written last, so each branch states its own.
	 */
	const reserved =
		'flex basis-full min-h-[calc(2*var(--spacing-chip)+0.5rem)] pointer-fine:min-h-19';
</script>

{#if mode === 'pill'}
	<button
		type="button"
		aria-label={pillLabel}
		onclick={() => (mode = 'chips')}
		class={[
			'flex min-h-11 w-20 shrink-0 flex-col items-center justify-center gap-0.5',
			'rounded-2xl bg-sunken focus-ring hover:bg-hover active:bg-surface-2',
			'pointer-fine:transition-[background-color] pointer-fine:duration-100'
		]}
	>
		<span
			class={[
				'text-xl leading-none font-extrabold tracking-numeral',
				rating === null ? 'text-ink-faint' : 'text-accent-text'
			]}
		>
			{shown}
		</span>
		<span class="label-caps">{name}</span>
	</button>
{:else if mode === 'chips'}
	<div class="{reserved} items-center">
		<ChipGroup
			bind:value={() => selected, pick}
			layout="rungs"
			label="{name} for this set"
			class="w-full"
		>
			{#each rungs as rung (rung)}
				<Chip value={rung} column>{rung}</Chip>
			{/each}

			<Chip value="custom" column aria-label="Other {name} value">
				<More size={20} />
			</Chip>
		</ChipGroup>
	</div>
{:else}
	<div class="{reserved} items-stretch gap-2">
		<button
			type="button"
			aria-label="Back to the {name} chips"
			onclick={() => (mode = 'chips')}
			class="grid w-11 shrink-0 place-items-center rounded-2xl bg-sunken text-2xl leading-none
				font-bold text-ink-muted focus-ring hover:bg-hover active:bg-surface-2 active:text-ink"
		>
			‹
		</button>

		<StepperField
			label={name}
			value={rating === null ? null : shownExertion(rating, scale)}
			recalled={null}
			step={EXERTION_STEP}
			min={shownMin(scale)}
			max={shownMax(scale)}
			class="flex-1"
			onchange={(v) => onchange(v === null ? null : storedExertion(v, scale))}
		/>
	</div>
{/if}
