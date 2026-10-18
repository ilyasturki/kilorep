<script lang="ts">
	import { barIcon } from '$lib/nav/chrome';
	import { backDecision, follow } from '$lib/nav/go';
	import CaretLeft from '$lib/ui/icons/CaretLeft.svelte';
	import { press } from '$lib/ui/press';

	let {
		href,
		label,
		class: extra
	}: { href: string; label: string; class?: string | undefined } = $props();

	// The href serves a new tab and a minimize; any other plain click walks the system's back.
	function walk(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}

		const decision = backDecision();

		if (decision.kind === 'minimize') {
			return;
		}

		event.preventDefault();
		void follow(decision);
	}
</script>

<a {href} aria-label={label} onclick={walk} class={[barIcon, extra]} {@attach press()}>
	<CaretLeft size={20} />
</a>
