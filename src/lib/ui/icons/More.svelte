<script lang="ts">
	// The set-options affordance shown when there is a mouse. Same reason as
	// Backspace: ⋯ (U+22EF) is absent from the shipped Nunito subset.
	type Props = {
		size?: number;
		class?: string;
	};

	let { size = 24, class: klass }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	aria-hidden="true"
	class={klass}
	focusable="false"
>
	<circle cx="5" cy="12" r="1.9" />
	<circle cx="12" cy="12" r="1.9" />
	<circle cx="19" cy="12" r="1.9" />
</svg>
