<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- One provider for the app, not one per Tooltip. Each one attaches a window
     scroll listener for its whole lifetime, so a screen with four ⓘ marks was
     paying for four; grouping them here is also what makes `skipDelayDuration`
     work, so moving between two adjacent marks does not re-pay the delay. -->
<Tooltip.Provider delayDuration={150}>
	{@render children()}
</Tooltip.Provider>
