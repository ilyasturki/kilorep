<script lang="ts" module>
	/**
	 * One fetch per id per app, not per mount: the catalog list now draws a
	 * thumb on every row and the insert sheet re-mounts that list on every
	 * open, which would otherwise be one fetch per catalog entry a tap. Keyed
	 * by id, holding the promise rather than the text so concurrent rows share
	 * one request.
	 *
	 * A 404 caches as `null` — the file is genuinely absent (customs, and any
	 * entry shipped without art) and asking again will not draw it. A *thrown*
	 * fetch is different: that is the network, not the catalog, so the entry
	 * is dropped and the next mount retries.
	 */
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
