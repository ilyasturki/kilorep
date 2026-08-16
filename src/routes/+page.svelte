<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Button from '$lib/ui/Button.svelte';

	const pillars = [
		{
			name: 'Yours',
			body: 'Self-hosted and open source. Full export, an open API, MCP. Your training history leaves whenever you want.'
		},
		{
			name: 'Fast',
			body: 'The in-gym loop is the product. The most common set, same as last time, is one tap.'
		},
		{
			name: 'Offline',
			body: 'The whole workout works with zero bars. The server is optional; the phone is complete on its own.'
		}
	];

	const repo = 'https://github.com/ilyasturki/kilorep';
</script>

<svelte:head>
	<title>The workout tracker that is actually yours | Kilorep</title>
	<meta
		name="description"
		content="An open-source, self-hosted workout tracker built for speed on the gym floor. Works fully offline, and your data leaves whenever you want."
	/>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-14 px-6 py-20">
	<header class="flex flex-col gap-5">
		<p class="flex items-center gap-2.5">
			<img src={favicon} alt="" class="h-7 w-7" />
			<span class="text-xl font-extrabold tracking-tight">kilorep</span>
		</p>
		<h1 class="text-4xl font-extrabold tracking-tight text-balance">
			The workout tracker that is actually yours.
		</h1>
		<p class="max-w-xl text-lg text-pretty text-ink-muted">
			And faster in the gym than anything else. Open source, self-hosted, offline-first.
		</p>
	</header>

	<dl class="grid gap-8 sm:grid-cols-3">
		{#each pillars as pillar (pillar.name)}
			<div class="flex flex-col gap-2">
				<dt class="label-caps">{pillar.name}</dt>
				<dd class="text-md text-pretty text-ink-muted">{pillar.body}</dd>
			</div>
		{/each}
	</dl>

	<footer class="flex flex-col items-start gap-4">
		<div class="flex flex-wrap items-center gap-3">
			<Button href={repo} variant="commit">View on GitHub</Button>
			<Button href="/login" variant="secondary">Sign in</Button>
		</div>
		<p class="text-sm text-ink-faint">In development. No release yet.</p>
	</footer>
</main>
