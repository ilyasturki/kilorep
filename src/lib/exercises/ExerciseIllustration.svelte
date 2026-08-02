<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	/**
	 * The catalog entry's line-art thumb, from `static/illustrations/<id>.svg`
	 * — traced from kilorep v1's generated set, renamed to catalog ids at copy
	 * time. A missing file is a state, not an error: sumo-deadlift shipped
	 * without art, and customs never have any, so the component renders
	 * nothing rather than reserving space.
	 *
	 * Inlined (not `<img>`) so the single `fill="currentColor"` path inherits
	 * the ink the container sets. The `<svg` check is load-bearing: a web host
	 * may answer a missing path with the SPA fallback and a 200, and that
	 * payload must never reach `{@html}`.
	 */
	type Props = { id: string; name: string; class?: ClassValue };

	let { id, name, class: klass }: Props = $props();

	let svg = $state<string | null>(null);

	$effect(() => {
		let stale = false;

		// `id` is read before the first await, so the effect tracks it.
		void (async () => {
			let text: string | null = null;
			try {
				const res = await fetch(`/illustrations/${id}.svg`);
				text = res.ok ? await res.text() : null;
			} catch {
				text = null;
			}
			if (!stale) {
				svg = text !== null && text.startsWith('<svg') ? text : null;
			}
		})();

		return () => {
			stale = true;
		};
	});
</script>

{#if svg !== null}
	<div
		role="img"
		aria-label="{name} illustration"
		class={['text-ink-muted [&>svg]:h-full [&>svg]:w-full', klass]}
	>
		{@html svg}
	</div>
{/if}
