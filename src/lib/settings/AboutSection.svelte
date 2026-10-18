<script lang="ts">
	import { serverVersion } from '$lib/api/client';
	import Section from '$lib/settings/Section.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';

	type Props = {
		server: string | null;
	};

	let { server }: Props = $props();

	let remote = $state<string | null>(null);

	$effect(() => {
		const base = server;

		remote = null;

		if (base === null) {
			return;
		}

		let stale = false;

		void (async () => {
			const version = await serverVersion(base);

			if (!stale) {
				remote = version;
			}
		})();

		return () => {
			stale = true;
		};
	});
</script>

<Section title="About">
	<li>
		<ListRow title="Version" meta={import.meta.env.APP_VERSION} />
	</li>

	{#if remote !== null}
		<li>
			<ListRow title="Server" meta={remote} />
		</li>
	{/if}
</Section>
