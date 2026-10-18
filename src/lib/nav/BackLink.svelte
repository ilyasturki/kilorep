<script lang="ts">
	import { backDecision, follow } from '$lib/nav/go';
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

<a
	{href}
	aria-label={label}
	onclick={walk}
	class={[
		'grid min-h-chrome w-11 shrink-0 place-items-center rounded-full border',
		'border-line text-xl leading-none text-ink-muted focus-ring hover:bg-hover',
		'press:bg-surface-2',
		extra
	]}
	{@attach press()}
>
	‹
</a>
