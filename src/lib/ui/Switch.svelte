<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { Switch } from 'bits-ui';

	/**
	 * Settings toggles: keep-awake, sync, anything with two states and no
	 * consequence worth confirming.
	 *
	 * The whole row *is* the switch — the label and description live inside
	 * `Switch.Root`, which Bits UI renders as a single `button[role=switch]`.
	 * The obvious alternative, a ListRow with a switch dropped in its trailing
	 * slot, produces a control nested inside a control: two elements claiming
	 * one tap, and a screen reader announcing a button inside a button. This
	 * way there is exactly one interactive element and its target is the full
	 * `min-h-row`, not a 48×28 track.
	 *
	 * The track is `line-soft` rather than `sunken` when off. `sunken` collapses
	 * onto `canvas` in dark, and a Settings screen is a canvas.
	 */
	type Props = {
		label: string;
		description?: string;
		checked?: boolean;
		disabled?: boolean;
		class?: ClassValue;
	};

	let {
		label,
		description,
		checked = $bindable(false),
		disabled = false,
		class: klass
	}: Props = $props();

	const id = $props.id();
	const descriptionId = `${id}-description`;
</script>

<Switch.Root
	bind:checked
	{disabled}
	aria-labelledby={id}
	aria-describedby={description ? descriptionId : undefined}
	class={[
		'group flex min-h-row w-full items-center justify-between gap-4 rounded-xl focus-ring',
		'text-left disabled:pointer-events-none disabled:opacity-50',
		klass
	]}
>
	<span class="min-w-0">
		<span {id} class="block text-base font-bold text-ink">{label}</span>
		{#if description}
			<span id={descriptionId} class="block text-sm font-bold text-ink-faint">{description}</span>
		{/if}
	</span>

	<span
		class="flex h-7 w-12 shrink-0 items-center rounded-full border border-line bg-line-soft p-0.5
			transition-colors duration-150 group-data-[state=checked]:bg-accent"
	>
		<Switch.Thumb
			class="size-5.5 rounded-full border border-line bg-surface transition-transform duration-150
				data-[state=checked]:translate-x-5"
		/>
	</span>
</Switch.Root>
