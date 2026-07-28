<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { login } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import { resolveRedirect } from '$lib/api/redirect';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';

	/**
	 * The web surface's way in. The phone's is not this screen: connecting a
	 * server there mints a device token from Settings, which is a different
	 * credential with a different delivery — see `$lib/api/auth`. If that flow
	 * ever reuses this page, the card has to be reconsidered rather than
	 * inherited; a card centred in a viewport is a web shape, and DESIGN.md
	 * names desktop-shaped forms on a phone as an anti-goal.
	 */

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
	let formError = $state('');

	let pending = $state(false);

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
		const destination = resolveRedirect(page.url.searchParams.get('redirectTo'), page.url.origin);
		await goto(destination, { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Sign in — Kilorep</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-4 py-10">
	<div class="w-full max-w-sm">
		<!-- `novalidate` because the messages are ours. Left on, a `type="email"`
		     box raises the browser's own bubble on submit, which lands in a
		     different place, in a different voice, and about a different rule than
		     the server's. -->
		<form
			novalidate
			class="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
			onsubmit={submit}
		>
			<header class="flex flex-col gap-1.5">
				<p class="label-caps">Kilorep</p>
				<h1 class="text-xl font-extrabold tracking-tight">Sign in</h1>
			</header>

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

			<!-- The region is always in the DOM, empty or not. A live region that
			     appears at the same moment as its text is announced unreliably,
			     which on this screen means a failed sign-in that says nothing at
			     all to someone who cannot see the red. -->
			<div aria-live="polite">
				{#if formError !== ''}
					<p class="text-sm font-bold text-danger">{formError}</p>
				{/if}
			</div>

			<!-- A disabled commit is Button's dashed inert well, not a dimmed
			     button: unmistakably not pressable while the request is in flight. -->
			<Button type="submit" variant="commit" disabled={pending}>
				{pending ? 'Signing in…' : 'Sign in'}
			</Button>
		</form>

		<!-- STACK.md still carries "how a production instance creates its first
		     account" as open. Until it closes, the person staring at a login screen
		     they cannot pass is the operator, and this is the command that helps
		     them. Registration ships closed, so there is no sign-up link to offer
		     instead — and no endpoint that would say whether one applied. -->
		<p class="mt-4 px-1 text-sm text-ink-faint">
			No account yet? The first one is created on the server with
			<code class="font-bold">bun run account:create</code>.
		</p>
	</div>
</main>
