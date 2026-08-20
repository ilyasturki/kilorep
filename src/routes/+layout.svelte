<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { recordNavigation, startDepthTracking } from '$lib/nav/depth';
	import { wireHardwareBack } from '$lib/nav/hardware-back';
	import { wireNativeFeel } from '$lib/ui/native';

	let { children } = $props();

	$effect(() => wireHardwareBack());
	$effect(() => wireNativeFeel());

	if (browser) {
		startDepthTracking();
	}

	afterNavigate((navigation) => recordNavigation(navigation));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider delayDuration={150}>
	{@render children()}
</Tooltip.Provider>
