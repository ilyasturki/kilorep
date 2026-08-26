<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	import Segmented from '$lib/ui/Segmented.svelte';
	import Books from '$lib/ui/icons/Books.svelte';
	import Cards from '$lib/ui/icons/Cards.svelte';

	// Each page states which half it is rather than reading the URL — the answer is static per route.
	const halves = [
		{ value: '/plan/templates', href: '/plan/templates', label: 'Templates', icon: Cards },
		{ value: '/plan/exercises', href: '/plan/exercises', label: 'Exercises', icon: Books }
	];

	type Props = { value: '/plan/templates' | '/plan/exercises'; class?: ClassValue };

	let { value, class: klass }: Props = $props();
</script>

<div class={klass}>
	<Segmented items={halves} {value} label="Plan" />
</div>
