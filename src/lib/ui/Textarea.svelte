<script lang="ts">
	import type { ClassValue, HTMLTextareaAttributes } from 'svelte/elements';
	import Field from '$lib/ui/Field.svelte';

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
