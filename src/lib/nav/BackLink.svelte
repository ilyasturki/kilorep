<script lang="ts">
	import { backDepth } from '$lib/nav/depth';
	import { press } from '$lib/ui/press';

	let {
		href,
		label,
		class: extra
	}: { href: string; label: string; class?: string | undefined } = $props();

	function walkBack(event: MouseEvent): void {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}

		if (backDepth() === 0) {
			return;
		}

		event.preventDefault();
		history.back();
	}
</script>

<a
	{href}
	aria-label={label}
	onclick={walkBack}
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
