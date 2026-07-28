<script lang="ts">
	import Button from '$lib/ui/Button.svelte';

	// The three claims the product is built on: data ownership, the in-gym
	// loop, and extreme offline. Nothing here may promise a feature the
	// product does not have.
	const pillars = [
		{
			name: 'Yours',
			body: 'Self-hosted and open source. Full export, an open API, MCP. Your training history leaves whenever you want.'
		},
		{
			name: 'Fast',
			body: 'The in-gym loop is the product. The most common set — same as last time — is one tap.'
		},
		{
			name: 'Offline',
			body: 'The whole workout works with zero bars. The server is optional; the phone is complete on its own.'
		}
	];

	const repo = 'https://github.com/ilyasturki/kilorep';
</script>

<svelte:head>
	<title>Kilorep — the workout tracker that is actually yours</title>
	<meta
		name="description"
		content="An open-source, self-hosted workout tracker built for speed on the gym floor. Works fully offline, and your data leaves whenever you want."
	/>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-14 px-6 py-20">
	<header class="flex flex-col gap-5">
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
		<!-- Sign in stays `secondary`: only one filled button exists per screen and
		     the pitch's own call to action holds it. It is a plain anchor, so this
		     page stays prerenderable and the client router takes over on click.
		     It exists because someone opening their own instance lands here, and
		     typing `/login` from memory is not a way in. -->
		<div class="flex flex-wrap items-center gap-3">
			<Button href={repo} variant="commit">View on GitHub</Button>
			<Button href="/login" variant="secondary">Sign in</Button>
		</div>
		<p class="text-sm text-ink-faint">In development — no release yet.</p>
	</footer>
</main>
