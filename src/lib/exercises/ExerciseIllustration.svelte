<script lang="ts" module>
	// A 404 caches as `null` (the art is genuinely absent); a thrown fetch is
	// evicted so the next mount retries.
	const cache = new Map<string, Promise<string | null>>();

	function load(id: string): Promise<string | null> {
		const hit = cache.get(id);

		if (hit !== undefined) {
			return hit;
		}

		const pending = (async (): Promise<string | null> => {
			try {
				const res = await fetch(`/illustrations/${id}.svg`);
				const text = res.ok ? await res.text() : null;

				return text !== null && text.startsWith('<svg') ? text : null;
			} catch {
				cache.delete(id);

				return null;
			}
		})();

		cache.set(id, pending);

		return pending;
	}
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	type Props = { id: string; name: string; class?: ClassValue };

	let { id, name, class: klass }: Props = $props();

	let svg = $state<string | null>(null);

	$effect(() => {
		let stale = false;

		const pending = load(id);

		void (async () => {
			const text = await pending;

			if (!stale) {
				svg = text;
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
