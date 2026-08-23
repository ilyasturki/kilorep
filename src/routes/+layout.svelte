<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { shortcutsReady, wireShortcuts } from '$lib/app/launcher';
	import favicon from '$lib/assets/favicon.svg';
	import { recordNavigation, startDepthTracking } from '$lib/nav/depth';
	import { syncSystemBack, wireHardwareBack } from '$lib/nav/hardware-back';
	import { wireNativeFeel } from '$lib/ui/native';

	let { children } = $props();

	$effect(() => wireHardwareBack());
	$effect(() => wireNativeFeel());
	$effect(() => wireShortcuts());

	if (browser) {
		startDepthTracking();
	}

	// Order matters: `syncSystemBack` reads the depth `recordNavigation` has just written, and
	// tells Android whether the back press it is about to be offered belongs to the app. The
	// first of these is also the moment a launcher shortcut can finally be honoured — a cold
	// start from one arrives before the router exists to send anywhere.
	afterNavigate((navigation) => {
		recordNavigation(navigation);
		syncSystemBack();
		shortcutsReady();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider delayDuration={150}>
	{@render children()}
</Tooltip.Provider>
