<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/**
	 * The frame every labelled control sits in: the caps label above it, the
	 * error under it, and the `id` that ties the three together.
	 *
	 * It also puts the error slot somewhere Select and DatePicker can reach.
	 * They had no `error` prop at all while Input and Textarea each carried a
	 * private copy of one, so the first caller needing to mark a Select invalid
	 * would have invented its own paragraph and its own `aria-describedby`.
	 */
	type Props = {
		label: string;
		/** Shown under the control and announced with it. */
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
