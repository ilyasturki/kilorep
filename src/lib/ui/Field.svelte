<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	type Props = {
		label: string;
		error?: string;
		class?: ClassValue;
		children: Snippet<[{ id: string; describedBy: string | undefined; invalid: true | undefined }]>;
	};

	let { label, error, class: klass, children }: Props = $props();

	const id = $props.id();
	const errorId = `${id}-error`;
</script>

<div class={['flex flex-col gap-1.5', klass]}>
	<label class="label-caps" for={id}>{label}</label>
	{@render children({
		id,
		describedBy: error ? errorId : undefined,
		invalid: error ? true : undefined
	})}
	{#if error}
		<p id={errorId} class="text-sm font-bold text-danger">{error}</p>
	{/if}
</div>
