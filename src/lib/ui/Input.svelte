<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';
	import Field from '$lib/ui/Field.svelte';

	/**
	 * A labelled single-line field: exercise and template names, the server URL,
	 * the credentials on sign-in.
	 *
	 * Not for weights and reps. Those go through StepperField, which exists
	 * because a bare text field is the wrong control for a number you are
	 * nudging with a thumb between sets.
	 */
	type Props = Omit<HTMLInputAttributes, 'value' | 'class'> & {
		label: string;
		value?: string;
		/** Shown under the field and announced with it; also reddens the border. */
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
