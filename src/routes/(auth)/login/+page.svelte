<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { googleSignInUrl, login } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import { resolveRedirect } from '$lib/api/redirect';
	import favicon from '$lib/assets/favicon.svg';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import GoogleLogo from '$lib/ui/icons/GoogleLogo.svelte';

	import type { PageProps } from './$types';

	/**
	 * The web surface's way in. The phone's is not this screen: connecting a
	 * server there mints a device token from Settings, which is a different
	 * credential with a different delivery — see `$lib/api/auth`. If that flow
	 * ever reuses this page, the card has to be reconsidered rather than
	 * inherited; a card centred in a viewport is a web shape, and DESIGN.md
	 * names desktop-shaped forms on a phone as an anti-goal.
	 *
	 * Two ways in, and they are not equals. Google is the only way to *create* an
	 * account, so it leads and takes the single filled button the screen is
	 * allowed — `compact`, because a commit at gym scale wraps across two lines
	 * in a card this wide and leaves the wordmark and the heading looking like a
	 * caption to it. The password form is for accounts that already have a
	 * password — every one made with `account:create` — and folds away behind
	 * the second button, because on an instance that offers Google it is the
	 * minority path. Where no Google client is configured there is nothing to
	 * fold behind: the form is the page, and it takes the commit itself.
	 */

	/** `google` comes from the group's layout load — see `(auth)/+layout.ts`. */
	let { data }: PageProps = $props();

	let email = $state('');
	let password = $state('');

	/**
	 * Two kinds of failure, told apart by whether they point at a field.
	 *
	 * An empty box is the user's to fix and the message belongs on it. Whose
	 * credential was wrong is deliberately not something the server will say —
	 * one message covers an unknown address and a bad password, and the timing
	 * matches — so hanging its answer on the password field would assert
	 * something the server carefully refused to.
	 */
	let emailError = $state('');
	let passwordError = $state('');

	/**
	 * The Google round-trip has no promise to reject: it comes back as a fresh
	 * navigation, so a failure arrives in the URL and is read from there. Written
	 * by the callback in the same voice as the server's other messages.
	 */
	let formError = $state(page.url.searchParams.get('error') ?? '');

	/**
	 * Which of the two the screen is showing, kept in the URL rather than in a
	 * `$state` flag: the fold is a place you can be sent to and come back from,
	 * so the two buttons that move between them are real anchors and Back walks
	 * the same path they do.
	 *
	 * The cost is paid knowingly. `(auth)/+layout.ts` reads `url`, so each of
	 * these navigations re-runs its load — a session call and a Google call to
	 * reveal a form that was already rendered. Both are cheap, and the trade buys
	 * a reload that lands where you were.
	 *
	 * Open regardless when there is no Google button to be the obvious choice.
	 * Derived rather than seeded once, so an instance that gained or lost its
	 * Google client between loads does not keep drawing the old screen.
	 */
	let passwordOpen = $derived(!data.google || page.url.searchParams.get('method') === 'password');

	let pending = $state(false);

	const destination = $derived(
		resolveRedirect(page.url.searchParams.get('redirectTo'), page.url.origin)
	);

	/**
	 * The other side of the fold, as a path.
	 *
	 * Built from the current URL so `redirectTo` survives the trip — a deep link
	 * that bounced someone here must not be spent by opening a form. `error` is
	 * dropped on the way: it names something that happened at Google, and
	 * carrying it in the URL would resurrect the message on a reload long after
	 * it stopped being true. The banner itself is `$state` and stays put across
	 * the navigation, which is what someone reading it wants.
	 */
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
			// The server's own wording, verbatim: `invalid email or password`, and
			// the throttle's messages for 429 and 503. They are already written for
			// a person, and rephrasing them here would be a second copy to keep in
			// step with the one that matters.
			formError = error instanceof ApiError ? error.message : 'something went wrong, try again';
			pending = false;
			return;
		}

		// `pending` stays true through the navigation: the credential is real from
		// here on, and re-enabling the button while the next screen loads only
		// offers a second sign-in nobody wants.
		//
		// Validated again even though the guard wrote it — the guard is not the
		// only thing that can put a value there, and a link is enough.
		// `replaceState` keeps sign-in out of the history a Back press walks.
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

			<!-- The region is always in the DOM, empty or not. A live region that
			     appears at the same moment as its text is announced unreliably,
			     which on this screen means a failed sign-in that says nothing at
			     all to someone who cannot see the red. It sits above both paths
			     because either one can put a message in it.

			     Empty it has no height, but it is still a flex child and so still
			     takes a gap on each side — twice the space the heading should have
			     under it. The negative margin hands one of them back. Written as a
			     condition rather than `empty:`, which turns on whitespace text nodes
			     the compiler is free to keep or drop. -->
			<div aria-live="polite" class={formError === '' ? '-mt-5' : ''}>
				{#if formError !== ''}
					<p class="text-sm font-bold text-danger">{formError}</p>
				{/if}
			</div>

			{#if data.google}
				<!-- An anchor, not a button with a handler: this leaves the origin, and
				     a full navigation is what carries the browser to Google. The href
				     goes through `googleSignInUrl` so it is built on `apiBase()` rather
				     than written relative — hard rule 4. -->
				<Button href={googleSignInUrl(destination)} variant="commit" compact>
					<GoogleLogo size={20} />
					Continue with Google
				</Button>

				<!-- Hidden from the accessibility tree entire. It divides two things that
				     are already separated by being a link and a form, and read aloud the
				     word is a stray "or" between them. -->
				<p class="flex items-center gap-3" aria-hidden="true">
					<span class="h-px flex-1 bg-line-soft"></span>
					<span class="text-sm font-bold text-ink-faint">or</span>
					<span class="h-px flex-1 bg-line-soft"></span>
				</p>
			{/if}

			{#if passwordOpen}
				<!-- `novalidate` because the messages are ours. Left on, a `type="email"`
				     box raises the browser's own bubble on submit, which lands in a
				     different place, in a different voice, and about a different rule than
				     the server's. -->
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

					<!-- A disabled commit is Button's dashed inert well, not a dimmed
					     button: unmistakably not pressable while the request is in flight.
					     `secondary` whenever Google is on the screen, because only one
					     filled button exists per screen and Google has it. -->
					<Button type="submit" variant={data.google ? 'secondary' : 'commit'} disabled={pending}>
						{pending ? 'Signing in…' : 'Sign in'}
					</Button>
				</form>

				{#if data.google}
					<!-- Quiet, and quiet on purpose: it is a way out of a form nobody
					     arrives at by accident, and a second outlined button under the
					     first would leave the card ending in two boxes that look equally
					     like the one that submits. Absent without Google, where the form
					     is the whole screen and there is nowhere to go back to. -->
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
