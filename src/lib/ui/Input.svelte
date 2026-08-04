<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';
	import Field from '$lib/ui/Field.svelte';

	type Props = Omit<HTMLInputAttributes, 'value' | 'class'> & {
		label: string;
		value?: string;
		error?: string;
		class?: ClassValue;
	};

	let { label, value = $bindable(''), error, class: klass, ...rest }: Props = $props();
</script>

<Field {label} {error} class={klass}>
	{#snippet children({ id, describedBy, invalid })}
		<input
			{...rest}
			{id}
			bind:value
			aria-invalid={invalid}
			aria-describedby={describedBy}
			class={['field-box min-h-row focus-ring', error ? 'border-danger' : 'border-line']}
		/>
	{/snippet}
</Field>
