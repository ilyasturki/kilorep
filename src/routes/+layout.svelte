<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import favicon from '$lib/assets/favicon.svg';
	import { wireHardwareBack } from '$lib/nav/hardware-back';

	let { children } = $props();

	// The Android back button, owned for the app's whole life — here and not in
	// `(app)` because the login screen is outside that group and a press there
	// must not fall through to Capacitor's default. A no-op on the web.
	$effect(() => wireHardwareBack());
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
