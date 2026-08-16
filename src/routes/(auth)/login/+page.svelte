<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { googleStartUrl, login } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import { resolveRedirect } from '$lib/api/redirect';
	import favicon from '$lib/assets/favicon.svg';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import GoogleLogo from '$lib/ui/icons/GoogleLogo.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let email = $state('');
	let password = $state('');

	let emailError = $state('');
	let passwordError = $state('');

	let formError = $state(page.url.searchParams.get('error') ?? '');

	let passwordOpen = $derived(!data.google || page.url.searchParams.get('method') === 'password');

	let pending = $state(false);

	const destination = $derived(
		resolveRedirect(page.url.searchParams.get('redirectTo'), page.url.origin)
	);

	function fold(open: boolean): string {
		const url = new URL(page.url);

		url.searchParams.delete('error');
		if (open) {
			url.searchParams.set('method', 'password');
		} else {
			url.searchParams.delete('method');
		}

		return `${url.pathname}${url.search}`;
	}

	const openHref = $derived(fold(true));
	const closeHref = $derived(fold(false));

	async function submit(event: SubmitEvent) {
		event.preventDefault();

		emailError = email.trim() === '' ? 'enter your email' : '';
		passwordError = password === '' ? 'enter your password' : '';
		if (emailError !== '' || passwordError !== '') {
			return;
		}

		formError = '';
		pending = true;

		try {
			await login(email, password);
		} catch (error) {
			formError = error instanceof ApiError ? error.message : 'something went wrong, try again';
			pending = false;
			return;
		}

		await goto(destination, { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Sign in | Kilorep</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-4 py-10">
	<div class="w-full max-w-sm">
		<div class="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
			<header class="flex flex-col gap-1.5">
				<p class="flex items-center gap-2">
					<img src={favicon} alt="" class="h-5 w-5" />
					<span class="text-base font-extrabold tracking-tight">kilorep</span>
				</p>
				<h1 class="text-xl font-extrabold tracking-tight">Sign in</h1>
			</header>

			<!-- Always in the DOM: a live region inserted together with its text is announced
			     unreliably. Empty it still takes a flex gap on each side; `-mt-5` hands one back. -->
			<div aria-live="polite" class={formError === '' ? '-mt-5' : ''}>
				{#if formError !== ''}
					<p class="text-sm font-bold text-danger">{formError}</p>
				{/if}
			</div>

			{#if data.google}
				<Button href={googleStartUrl({ redirectTo: destination })} variant="commit" compact>
					<GoogleLogo size={20} />
					Continue with Google
				</Button>

				<p class="flex items-center gap-3" aria-hidden="true">
					<span class="h-px flex-1 bg-line-soft"></span>
					<span class="text-sm font-bold text-ink-faint">or</span>
					<span class="h-px flex-1 bg-line-soft"></span>
				</p>
			{/if}

			{#if passwordOpen}
				<form novalidate class="flex flex-col gap-5" onsubmit={submit}>
					<Input
						label="Email"
						name="email"
						type="email"
						autocomplete="email"
						inputmode="email"
						autocapitalize="none"
						spellcheck="false"
						bind:value={email}
						error={emailError}
					/>

					<Input
						label="Password"
						name="password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						error={passwordError}
					/>

					<Button type="submit" variant={data.google ? 'secondary' : 'commit'} disabled={pending}>
						{pending ? 'Signing in…' : 'Sign in'}
					</Button>
				</form>

				{#if data.google}
					<a
						href={closeHref}
						class="self-center rounded-lg px-2 py-1 text-sm font-bold text-ink-muted
						       underline underline-offset-4 focus-ring hover:text-ink"
					>
						Back
					</a>
				{/if}
			{:else}
				<Button href={openHref} variant="secondary">Sign in with a password</Button>
			{/if}
		</div>
	</div>
</main>
