<script lang="ts">
	import type { ClassValue, HTMLTextareaAttributes } from 'svelte/elements';
	import Field from '$lib/ui/Field.svelte';

	/**
	 * Multi-line free text: the set note, an exercise's own note.
	 *
	 * Resize is left to the browser on the vertical axis only: dragging a field
	 * wider than its column is never wanted, and on touch the handle does not
	 * exist at all.
	 */
	type Props = Omit<HTMLTextareaAttributes, 'value' | 'class'> & {
		label: string;
		value?: string;
		error?: string;
		class?: ClassValue;
	};

	let { label, value = $bindable(''), error, rows = 3, class: klass, ...rest }: Props = $props();
</script>

<Field {label} {error} class={klass}>
	{#snippet children({ id, describedBy, invalid })}
		<textarea
			{...rest}
			{id}
			{rows}
			bind:value
			aria-invalid={invalid}
			aria-describedby={describedBy}
			class={[
				'field-box resize-y py-3 leading-normal focus-ring',
				error ? 'border-danger' : 'border-line'
			]}></textarea>
	{/snippet}
</Field>
