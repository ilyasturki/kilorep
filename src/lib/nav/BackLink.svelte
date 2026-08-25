<script lang="ts">
	import { press } from '$lib/ui/press';

	let {
		href,
		label,
		class: extra
	}: { href: string; label: string; class?: string | undefined } = $props();
</script>

<!-- A plain anchor on purpose: `‹` walks up the hierarchy, not back through time. It used to
     be `history.back()` whenever there was history to walk, which read the tabs as steps —
     visiting Settings and then the live session put Settings behind `‹`. The declared parent
     is the answer wherever the button is pressed, and cmd-click works for free. -->
<a
	{href}
	aria-label={label}
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
