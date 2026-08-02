<script lang="ts">
	import { backDepth } from '$lib/nav/depth';

	/**
	 * The ‹ in the corner of every screen that is not a tab root.
	 *
	 * It was four copies of the same anchor pointing at four fixed parents, and
	 * a fixed parent is a guess about where the user came from. The guess was
	 * right while the only way into a detail screen was its own list, and wrong
	 * the moment the exercise screen grew a link into a workout: ‹ there landed
	 * on the History list, a place the user had never been. So it walks real
	 * history when there is any of ours to walk, and `href` is what it falls
	 * back to when there is not — a deep link, a fresh tab, a cold boot.
	 *
	 * Still an `<a>`, not a `<button>`. The fallback is a real destination, so
	 * middle-click, ⌘-click and "open in new tab" all keep working, the status
	 * bar shows somewhere real on hover, and a reader announces a link because
	 * a link is what it is. The handler only takes over the plain left click,
	 * which is the one the browser was about to spend on `href` anyway.
	 *
	 * `‹` is a character, like ListRow's `›` — measured: U+2039 is present in
	 * the shipped subset.
	 */
	let {
		href,
		label,
		class: extra
	}: { href: string; label: string; class?: string | undefined } = $props();

	function walkBack(event: MouseEvent): void {
		// Every modified click is the user asking for a second window, and a
		// second window has no history of ours to walk. Let the browser have it.
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
		'border-line text-xl leading-none text-ink-muted focus-ring hover:bg-surface-2',
		'active:bg-surface-2',
		extra
	]}
>
	‹
</a>
