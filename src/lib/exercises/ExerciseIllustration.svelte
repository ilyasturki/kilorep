<script lang="ts" module>
	// A failed response caches as `null`; a thrown fetch is evicted so the next mount retries.
	const cache = new Map<string, Promise<string | null>>();

	function load(file: string): Promise<string | null> {
		const hit = cache.get(file);

		if (hit !== undefined) {
			return hit;
		}

		const pending = (async (): Promise<string | null> => {
			try {
				const res = await fetch(`/illustrations/${file}.svg`);
				const text = res.ok ? await res.text() : null;

				return text !== null && text.startsWith('<svg') ? text : null;
			} catch {
				cache.delete(file);

				return null;
			}
		})();

		cache.set(file, pending);

		return pending;
	}
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	import { illustrationFor } from '$lib/exercises/illustration';

	type Props = { id: string; name: string; grip?: string | null; class?: ClassValue };

	let { id, name, grip, class: klass }: Props = $props();

	const file = $derived(illustrationFor(id, grip));

	let svg = $state<string | null>(null);

	$effect(() => {
		if (file === null) {
			svg = null;

			return;
		}

		let stale = false;

		const pending = load(file);

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
