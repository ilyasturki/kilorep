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

	function pick(next: string) {
		if (next === 'custom') {
			mode = 'custom';

			return;
		}

		onchange(next === 'clear' || next === '' ? null : storedExertion(Number(next), scale));
		mode = 'pill';
	}
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
	<ChipGroup
		bind:value={() => selected, pick}
		layout="line"
		label="{name} for this set"
		class="basis-full py-0.5"
	>
		<Chip value="clear" column>–</Chip>

		{#each rungs as rung (rung)}
			<Chip value={rung} column>{rung}</Chip>
		{/each}

		<Chip value="custom" column aria-label="Other {name} value">
			<More size={20} />
		</Chip>
	</ChipGroup>
{:else}
	<div class="flex basis-full items-stretch gap-2">
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
