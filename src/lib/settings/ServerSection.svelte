<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import { logout, signInDevice } from '$lib/api/auth';
	import {
		ApiError,
		DEFAULT_SERVER,
		apiBase,
		checkServer,
		lastServer,
		setApiBase,
		setLastServer
	} from '$lib/api/client';
	import { signInWithGoogle } from '$lib/api/google-device';
	import Section from '$lib/settings/Section.svelte';
	import { getStore } from '$lib/store/store';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import GoogleLogo from '$lib/ui/icons/GoogleLogo.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { Account } from '$lib/api/auth';

	/**
	 * The server, in the app build only. On the web the origin serving the page
	 * *is* the server, and a section for it would be a question with one answer.
	 *
	 * Nothing here ends the connected state: that is Sign out, one section up,
	 * where the account it belongs to is.
	 *
	 * The section asks for an account rather than for an address. kilorep.com is
	 * where it means to sign in and the address is never on screen unless
	 * somebody wants a different one — which is a fork in the form, not a step in
	 * front of it. Connecting stops being a thing the user does at all on that
	 * path: it is what signing in did.
	 *
	 * This is also the only place the phone signs in: `/login` is a card centred
	 * in a viewport, which DESIGN.md names as an anti-goal on a phone, and the
	 * credential it mints is a cookie the WebView could not use.
	 */
	type Props = {
		/** The layout's session: null is local-only, which is an ordinary state. */
		user: Account | null;
		/** Whether the server behind the form has Google to offer. */
		google: boolean;
		/** Whether this device holds a credential. Assigned on both sides. */
		credentialled: boolean;
		/** The address the user's own action put in place, or null. */
		server: string | null;
	};

	let { user, google, credentialled = $bindable(), server = $bindable() }: Props = $props();

	const defaultHost = new URL(DEFAULT_SERVER).host;

	let addressOpen = $state(false);
	let address = $state(lastServer() ?? '');
	let serverError = $state('');
	let connectPending = $state(false);

	/**
	 * "gym.example.com" is what someone types; a scheme-carrying URL with no
	 * trailing slash is what `request` needs to prepend to `/api/…`. Throws on
	 * garbage, which connect() reports as its own validation error.
	 */
	function normalize(input: string): string {
		const trimmed = input.trim();
		const withScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

		return new URL(withScheme).href.replace(/\/$/u, '');
	}

	async function connect() {
		serverError = '';

		let base: string;
		try {
			base = normalize(address);
		} catch {
			serverError = 'enter a server address';
			return;
		}

		connectPending = true;

		try {
			await checkServer(base);
		} catch (error) {
			serverError = error instanceof ApiError ? error.message : 'could not reach the server';
			connectPending = false;
			return;
		}

		setApiBase(base);
		setLastServer(base);
		server = base;

		// What `normalize` made of it, so the field agrees with the address the
		// requests will carry rather than with the shorthand that was typed.
		address = base;
		addressOpen = false;

		// Connected, and not signed in — which is a complete state, not a
		// half-finished one. The card below turns into the way in, and
		// `invalidateAll` is what asks the new server whether it offers Google.
		await invalidateAll();
		connectPending = false;
	}

	/**
	 * Back out of a typed address without having signed in to it.
	 *
	 * The one exit this section still needs: the kilorep.com path never holds an
	 * address without a credential, and a signed-in phone leaves through Sign
	 * out. Nothing to revoke — there is no credential yet, which is the whole
	 * definition of this state — and the address stays in the field to be
	 * corrected rather than retyped.
	 */
	async function forget() {
		setApiBase(null);
		server = null;

		await invalidateAll();
	}

	/**
	 * The address the credential is about to be minted against, put in place
	 * before the request that needs it: `signInDevice` and `googleStartUrl` both
	 * read `apiBase()`, so there is no signing in to a server the client is not
	 * already pointed at.
	 *
	 * `server` is deliberately left where it is. It is what the rows branch on,
	 * and moving it here would swap the form for the connected card underneath a
	 * request still in flight — and it is what makes the rollback decidable:
	 * `server === null` says this address was the sign-in's doing and not the
	 * user's, so a wrong password takes it back out again rather than leaving the
	 * phone half-connected to somewhere nobody chose.
	 */
	function standTo(): void {
		if (server === null) {
			setApiBase(DEFAULT_SERVER);
		}
	}

	function standDown(): void {
		if (server === null) {
			setApiBase(null);
		}
	}

	let signInOpen = $state(false);
	let email = $state('');
	let password = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let signInError = $state('');
	let signInPending = $state(false);
	let googlePending = $state(false);

	function openSignIn() {
		emailError = '';
		passwordError = '';
		signInError = '';
		signInOpen = true;
	}

	/**
	 * The account a sign-in just produced, held only while the store's owner is
	 * being resolved. Non-null exactly while the sheet below is the screen's
	 * business.
	 */
	let arriving = $state<Account | null>(null);
	let mismatchOpen = $state(false);
	let wipeOpen = $state(false);

	/**
	 * What every sign-in path ends in, whichever credential it used.
	 *
	 * The store is tied to one account — `claimOwner` refuses to sync a store
	 * that belongs to somebody else, silently, because there is no screen down in
	 * the sync layer to say so. This is that screen: the one moment the mismatch
	 * is visible and someone is present to decide about it. Everything else is
	 * the ordinary case, where the store is unowned or already theirs and the
	 * launch sync in the layout takes it from here.
	 */
	async function settle(account: Account) {
		credentialled = true;
		signInOpen = false;

		const store = await getStore();
		const owner = await store.owner();

		if (owner !== null && owner !== account.id) {
			arriving = account;
			mismatchOpen = true;
			return;
		}

		// `server` catches up here and not in `standTo`: the address is the user's
		// own from the moment a credential exists for it, and until then it is on
		// loan.
		server = apiBase();

		await invalidateAll();
	}

	function reportSignIn(error: unknown): void {
		signInError = error instanceof ApiError ? error.message : 'could not sign in, try again';
	}

	async function signIn() {
		emailError = email.trim() === '' ? 'enter your email' : '';
		passwordError = password === '' ? 'enter your password' : '';
		if (emailError !== '' || passwordError !== '') {
			return;
		}

		signInError = '';
		signInPending = true;
		standTo();

		try {
			const account = await signInDevice(email.trim(), password);
			// Cleared on success only. A wrong password is retyped, not the address.
			password = '';
			await settle(account);
		} catch (error) {
			standDown();
			reportSignIn(error);
		}

		signInPending = false;
	}

	async function withGoogle() {
		signInError = '';
		googlePending = true;
		standTo();

		try {
			await settle(await signInWithGoogle());
		} catch (error) {
			standDown();
			reportSignIn(error);
		}

		googlePending = false;
	}

	/**
	 * The two answers to the mismatch, which differ only in what happens to the
	 * records — everything around that is the same handover.
	 *
	 * `adopt`: everything logged on this phone becomes the new account's, and
	 * nothing is lost on either side. The server keys records per account, so
	 * these arrive as new rows and the previous account keeps its own copies.
	 *
	 * `wipe`: the phone changed hands. Everything local goes, then a full pull.
	 */
	async function handOver(mode: 'adopt' | 'wipe') {
		if (arriving === null) {
			return;
		}

		const { id } = arriving;

		// Cleared before the sheet closes, so the dismissal effect below reads
		// this as a decision already made rather than as a cancellation.
		arriving = null;
		mismatchOpen = false;

		const store = await getStore();

		if (mode === 'wipe') {
			await store.wipe(id);

			// The holder outlives the snapshot it was restored from, so a session
			// left running would survive its own records and write itself back on
			// finish.
			activeWorkout.finish();
		} else {
			await store.adopt(id);
		}

		// Answered, so signed in, so the address is theirs — the leg `settle` did
		// not reach when it stopped to ask.
		server = apiBase();

		await invalidateAll();
	}

	/**
	 * Backing out: the credential is given up and the phone stays local-only,
	 * exactly as it was a moment ago.
	 *
	 * Reached by the sheet's Cancel and by dismissing it, which are the same
	 * decision — leaving a token in place after refusing to answer the question
	 * would sync nothing and explain nothing.
	 */
	async function abandon() {
		arriving = null;
		mismatchOpen = false;
		credentialled = false;

		try {
			await logout();
		} catch {
			// The credential is dropped locally regardless; the token list on the
			// server is where a row that outlived this gets revoked.
		}

		// After the revocation, which needs the address to reach the server it is
		// giving the credential back to — and only if the sign-in is what put that
		// address there. Refusing the question leaves the phone exactly as it was.
		standDown();

		await invalidateAll();
	}

	$effect(() => {
		if (!mismatchOpen && arriving !== null) {
			void abandon();
		}
	});
</script>

<Section title="Server">
	{#if server !== null && credentialled}
		<!-- The address as it was given, scheme and all, and not the host alone:
		     a self-hoster on plain http over a LAN is looking at the one line that
		     says so. `user === null` here is a server that did not answer — a
		     credential the server refused is dropped by `request`, which lands in
		     the signed-out branch below instead. -->
		<li>
			<ListRow title={server} meta={user === null ? 'Unreachable' : 'Signed in'} />
		</li>
	{:else if server !== null}
		<!-- Connected and signed out, which is a state the app runs in rather than
		     a door it stands behind: everything logged here still works, and the
		     row below is how sync starts. -->
		<li>
			<ListRow title={server} meta="Not signed in" />
		</li>

		<li>
			<ListRow title="Sign in" onclick={openSignIn} chevron />
		</li>

		<li>
			<ListRow title="Use a different server" onclick={() => void forget()} chevron />
		</li>
	{:else}
		<li>
			<ListRow title="Sign in to {defaultHost}" onclick={openSignIn} chevron />
		</li>

		<li>
			<ListRow title="Use my own server" onclick={() => (addressOpen = true)} chevron />
		</li>
	{/if}

	{#snippet footer()}
		{#if server === null}
			<p class="text-sm text-pretty text-ink-muted">
				Everything lives on this phone. Signing in adds sync, the web surface and the API — and
				takes nothing away.
			</p>
		{/if}
	{/snippet}
</Section>

<Sheet
	bind:open={signInOpen}
	title="Sign in to {server === null ? defaultHost : new URL(server).host}"
	description="Sync this phone with that server. Nothing logged here is lost either way."
>
	<!-- One form, two servers. Which one it signs in to is the address in
	     `apiBase` when the button is pressed, and that is the only difference
	     between the two paths this section offers. -->
	<div class="flex flex-col gap-5 pt-2">
		{#if google}
			<Button variant="secondary" disabled={googlePending || signInPending} onclick={withGoogle}>
				<GoogleLogo size={18} />
				{googlePending ? 'Waiting for Google…' : 'Continue with Google'}
			</Button>
		{/if}

		<Input
			label="Email"
			name="email"
			type="email"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			inputmode="email"
			autocomplete="email"
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

		<Button variant="secondary" disabled={signInPending || googlePending} onclick={signIn}>
			{signInPending ? 'Signing in…' : 'Sign in'}
		</Button>

		<div aria-live="polite">
			{#if signInError !== ''}
				<p class="text-sm font-bold text-danger">{signInError}</p>
			{/if}
		</div>
	</div>
</Sheet>

<Sheet
	bind:open={addressOpen}
	title="Use my own server"
	description="It has to be reachable from here. A LAN address works while the phone is on that network, and stops working when it leaves."
>
	<div class="flex flex-col gap-5 pt-2">
		<Input
			label="Server address"
			name="server"
			placeholder="gym.example.com"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			inputmode="url"
			bind:value={address}
			error={serverError}
		/>

		<Button variant="secondary" disabled={connectPending} onclick={connect}>
			{connectPending ? 'Checking…' : 'Connect'}
		</Button>
	</div>
</Sheet>

<!-- Three-way, so a Sheet rather than the AlertDialog the rest of this screen
     uses: the destructive option is one of the choices, not the whole question,
     and it keeps its own confirm below. -->
<Sheet
	bind:open={mismatchOpen}
	title="This phone belongs to another account"
	description="Everything logged here was synced as somebody else. Choose what happens to it before {arriving?.email ??
		'the new account'} takes over."
>
	<div class="flex flex-col gap-5 pt-2">
		<div class="flex flex-col gap-2">
			<Button variant="secondary" onclick={() => void handOver('adopt')}>
				Move it to this account
			</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Every workout, template and weight on this phone is copied across. The other account keeps
				its own.
			</p>
		</div>

		<div class="flex flex-col gap-2">
			<Button variant="destructive" onclick={() => (wipeOpen = true)}>Erase this phone</Button>
			<p class="px-1 text-sm text-pretty text-ink-muted">
				Local data is deleted and replaced with whatever the new account has on the server.
			</p>
		</div>

		<Button variant="chrome" caps onclick={() => void abandon()}>CANCEL</Button>
	</div>
</Sheet>

<AlertDialog
	bind:open={wipeOpen}
	title="Erase everything on this phone?"
	description="Every workout, template and body weight held here is deleted, including any that never reached a server. There is no undo."
	confirmLabel="Erase"
	onconfirm={() => void handOver('wipe')}
/>
