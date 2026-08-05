<script lang="ts">
	import { backDepth } from '$lib/nav/depth';
	import { press } from '$lib/ui/press';

	/**
	 * The bar's way up: an ordinary link to the parent, which walks real history
	 * instead wherever there is any of this app's behind us.
	 *
	 * A link and not a button, because `href` is what makes it a middle-click,
	 * a long-press "open in new tab", and a keyboard's link — and what answers
	 * the one case history cannot, a cold boot straight onto a detail screen or
	 * a notification tap, which has nothing to walk. Any modified click is left
	 * to the browser for the same reason.
	 */
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
