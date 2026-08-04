<script lang="ts" module>
	export type SelectOption = {
		value: string;
		label: string;
		disabled?: boolean;
	};
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { fade } from 'svelte/transition';
	import { Select } from 'bits-ui';
	import Field from '$lib/ui/Field.svelte';
	import SheetHeader from '$lib/ui/SheetHeader.svelte';
	import CaretDown from '$lib/ui/icons/CaretDown.svelte';
	import Check from '$lib/ui/icons/Check.svelte';
	import { registerOverlay } from '$lib/ui/overlays';
	import { wideViewport } from '$lib/ui/viewport';

	type Props = {
		label: string;
		items: SelectOption[];
		value?: string | string[];
		type?: 'single' | 'multiple';
		error?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: ClassValue;
	};

	let {
		label,
		items,
		value = $bindable(),
		type = 'single',
		error,
		placeholder = 'Choose',
		disabled = false,
		class: klass
	}: Props = $props();

	let open = $state(false);

	$effect(() => (open ? registerOverlay(() => (open = false)) : undefined));

	const selected = $derived(
		type === 'multiple'
			? items.filter((item) => Array.isArray(value) && value.includes(item.value))
			: items.filter((item) => item.value === value)
	);

	const display = $derived(selected.map((item) => item.label).join(', '));
</script>

{#snippet trigger(id: string, describedBy: string | undefined, invalid: true | undefined)}
	<Select.Trigger
		{id}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		class={[
			'field-box field-trigger min-h-row focus-ring',
			error ? 'border-danger' : 'border-line'
		]}
	>
		<span class={['truncate', !display && 'text-ink-faint']}>{display || placeholder}</span>
		<CaretDown size={18} class="shrink-0 text-ink-muted" />
	</Select.Trigger>
{/snippet}

{#snippet list()}
	<Select.Viewport class="min-h-0 flex-1 overflow-y-auto p-2">
		{#each items as item (item.value)}
			<Select.Item
				value={item.value}
				label={item.label}
				disabled={item.disabled}
				class="flex min-h-row w-full items-center gap-3 rounded-xl px-3 text-base font-bold
					select-none data-disabled:pointer-events-none data-disabled:opacity-50
					data-highlighted:bg-hover"
			>
				{#snippet children({ selected: isSelected })}
					<span class="min-w-0 flex-1 truncate">{item.label}</span>
					{#if isSelected}
						<Check size={20} class="shrink-0 text-accent-text" />
					{/if}
				{/snippet}
			</Select.Item>
		{/each}
	</Select.Viewport>
{/snippet}

{#snippet panel()}
	{#if wideViewport.current}
		<Select.Portal>
			<Select.Content
				sideOffset={6}
				class="overlay-menu max-h-[min(20rem,var(--bits-select-content-available-height))]
					min-w-(--bits-select-anchor-width)"
			>
				{@render list()}
			</Select.Content>
		</Select.Portal>
	{:else}
		<Select.Portal>
			<!-- Select has no Overlay part, so the scrim is ours — and so is its
			     lifetime. `Select.Portal` is only a portal: it mounts its children
			     whether or not the list is open, and it is `ContentStatic` that Bits
			     UI gates on presence. Without this `{#if}` the scrim sits over the
			     page permanently, which is exactly how it first shipped.

			     Svelte's own fade rather than the `[data-starting-style]` hooks
			     `overlay-scrim` reads, because Bits UI sets those on parts it owns
			     and this is not one. The duration matches the utility's. -->
			{#if open}
				<div class="overlay-scrim" transition:fade={{ duration: 180 }}></div>
			{/if}

			<Select.ContentStatic class="overlay-panel overlay-sheet">
				<SheetHeader title={label} />
				{@render list()}
			</Select.ContentStatic>
		</Select.Portal>
	{/if}
{/snippet}

<Field {label} {error} class={klass}>
	{#snippet children({ id, describedBy, invalid })}
		{#if type === 'multiple'}
			<Select.Root
				type="multiple"
				{items}
				{disabled}
				bind:open
				bind:value={() => (Array.isArray(value) ? value : []), (next) => (value = next)}
			>
				{@render trigger(id, describedBy, invalid)}
				{@render panel()}
			</Select.Root>
		{:else}
			<Select.Root
				type="single"
				{items}
				{disabled}
				bind:open
				bind:value={() => (typeof value === 'string' ? value : ''), (next) => (value = next)}
			>
				{@render trigger(id, describedBy, invalid)}
				{@render panel()}
			</Select.Root>
		{/if}
	{/snippet}
</Field>
