<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { session } from '$lib/api/auth';
	import { AFTER_LOGIN } from '$lib/api/redirect';
	import favicon from '$lib/assets/favicon.svg';
	import Button from '$lib/ui/Button.svelte';

	const pillars = [
		{
			name: 'Fast',
			body: "One tap logs a set. Every set shows last time's weight and reps, and logging it starts the rest timer."
		},
		{
			name: 'Offline',
			body: 'A whole workout runs with no signal and no account. Sign in to a server only when you want sync.'
		},
		{
			name: 'Yours',
			body: 'MIT open source. Export it all as JSON or CSV, sync through kilorep.com or your own server, and let an agent read and log your training over MCP.'
		}
	];

	const repo = 'https://github.com/ilyasturki/kilorep';
	const download = `${repo}/releases/latest`;
	const selfHost = `${repo}#self-host-on-nixos`;

	const site = 'https://kilorep.com';
	const title = 'Kilorep, a workout log that works offline';
	const description =
		'A workout log for Android and the web. One tap per set, works offline, syncs through kilorep.com or your own server. MIT open source.';

	onMount(async () => {
		try {
			await session(fetch);
		} catch {
			return;
		}

		await goto(AFTER_LOGIN, { replaceState: true });
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={site} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={`${site}/og.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-14 px-4 py-16 sm:px-6 sm:py-20">
	<header class="flex max-w-2xl flex-col gap-5">
		<p class="flex items-center gap-2.5">
			<img src={favicon} alt="" class="h-7 w-7" />
			<span class="text-xl font-extrabold tracking-tight">kilorep</span>
		</p>
		<h1 class="text-4xl font-extrabold tracking-tight text-balance">
			A workout log fast enough to use between sets.
		</h1>
		<p class="text-lg text-pretty text-ink-muted">
			Android and web. I wrote it to replace the Google Sheet I used to fill in mid-workout.
		</p>

		<div class="flex flex-wrap items-center gap-3 pt-2">
			<Button href={download} variant="commit">Download for Android</Button>
			<Button href="/login" variant="secondary">Use it on the web</Button>
		</div>
		<p class="text-sm text-ink-faint">
			Or run your own server. The
			<a href={selfHost} class="underline decoration-2 underline-offset-2">README</a>
			covers NixOS and plain Node.
		</p>
	</header>

	<div class="grid items-end gap-4 sm:grid-cols-[3.47fr_1fr] sm:gap-5">
		<picture class="order-2 sm:order-1">
			<source media="(prefers-color-scheme: dark)" srcset="/screens/progress-dark.webp" />
			<img
				src="/screens/progress-light.webp"
				alt="Kilorep: the Progress page on a wide screen, weekly tonnage, records and estimated 1RM"
				width="1600"
				height="1000"
				class="w-full rounded-2xl border border-line"
			/>
		</picture>
		<picture class="order-1 mx-auto w-3/5 sm:order-2 sm:w-full">
			<source media="(prefers-color-scheme: dark)" srcset="/screens/live-dark.webp" />
			<img
				src="/screens/live-light.webp"
				alt="Kilorep: a workout in progress on a phone, with the rest timer"
				width="780"
				height="1691"
				class="w-full rounded-3xl border border-line"
			/>
		</picture>
	</div>

	<dl class="grid gap-8 sm:grid-cols-3">
		{#each pillars as pillar (pillar.name)}
			<div class="flex flex-col gap-2">
				<dt class="label-caps">{pillar.name}</dt>
				<dd class="text-md text-pretty text-ink-muted">{pillar.body}</dd>
			</div>
		{/each}
	</dl>

	<footer class="text-sm text-ink-faint">
		<a href={repo} class="underline decoration-2 underline-offset-2">Source on GitHub</a>, MIT
		licensed.
	</footer>
</main>
