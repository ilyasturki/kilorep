<script lang="ts">
	import '../app.css';
	import { Tooltip } from 'bits-ui';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import { recordNavigation, startDepthTracking } from '$lib/nav/depth';
	import { wireHardwareBack } from '$lib/nav/hardware-back';

	let { children } = $props();

	// The Android back button, owned for the app's whole life — here and not in
	// `(app)` because the login screen is outside that group and a press there
	// must not fall through to Capacitor's default. A no-op on the web.
	$effect(() => wireHardwareBack());

	// How deep into the app the user is, counted here because this is the one
	// component that outlives every navigation — a page or a group layout would
	// miss the steps taken before it mounted. Both back buttons read the count;
	// `depth.ts` explains why the browser cannot be asked instead.
	//
	// Started at init and not in `onMount`, so the count is restored before the
	// first `afterNavigate` fires. Guarded here rather than inside `depth.ts`
	// because this is the one layout that also renders on a server — it carries
	// the marketing page, the single route rule 5 exempts. `afterNavigate` needs
	// no guard: it is `onMount` underneath, which the server never runs.
	if (browser) {
		startDepthTracking();
	}

	afterNavigate((navigation) => recordNavigation(navigation));
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
