<script lang="ts">
	import { page } from '$app/state';

	import { fillAppBar } from '$lib/nav/bar.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Info from '$lib/ui/icons/Info.svelte';

	const title = $derived(page.status === 404 ? 'Not found' : 'Something went wrong');

	fillAppBar(() => ({ title }));
</script>

<svelte:head>
	<title>{title} | Kilorep</title>
</svelte:head>

<main class="min-h-0 flex-1 overflow-y-auto">
	<div class="column-content flex min-h-full flex-col px-3">
		<EmptyState {title} description={page.error?.message}>
			{#snippet icon()}
				<Info size={24} />
			{/snippet}
		</EmptyState>
	</div>
</main>
