<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	import { createToken, logout, revokeToken, signInDevice } from '$lib/api/auth';
	import { ApiError, apiBase, checkServer, deviceToken, setApiBase } from '$lib/api/client';
	import { signInWithGoogle } from '$lib/api/google-device';
	import BackLink from '$lib/nav/BackLink.svelte';
	import { exertionScale } from '$lib/settings/exertion.svelte';
	import { getStore } from '$lib/store/store';
	import { syncSoon } from '$lib/sync/client';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ChipGroup from '$lib/ui/ChipGroup.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';
	import GoogleLogo from '$lib/ui/icons/GoogleLogo.svelte';
	import Plugs from '$lib/ui/icons/Plugs.svelte';
	import { activeWorkout } from '$lib/workout/active.svelte';

	import type { Account, PublicToken } from '$lib/api/auth';
	import type { PageProps } from './$types';

	/**
	 * Settings — behind Start's gear, per PRODUCT.md, and everything the loop
	 * never needs: the account, the server, the credentials. Three sections
	 * that each earn their place by state rather than by build flag alone:
	 *
	 * - Account and API tokens exist when someone is signed in.
	 * - Server exists only in the app build, where connecting one is a choice.
	 *   On the web the origin serving the page *is* the server, and a field for
	 *   it would be a question with one answer.
	 *
	 * Local-only in the app is all three collapsed to the connect form — the
	 * layout reads "no server" as an ordinary state and hands `user: null`, so
	 * this screen is where that state can end. It is also the only place the
	 * phone signs in: `/login` is a card centred in a viewport, which DESIGN.md
	 * names as an anti-goal on a phone, and the credential it mints is a cookie
	 * the WebView could not use. Address, then account, in the section that owns
	 * both.
	 */
	let { data }: PageProps = $props();

	/**
	 * The rating's name, written to the holder and to the record behind it.
	 *
	 * The chips are a `single` toggle group, so a tap on the lit one answers with
	 * an empty string — which here would mean "no scale at all", a state nothing
	 * downstream can render. Ignored rather than guarded against in the markup:
	 * the group is a choice between two, and re-tapping the chosen one is a
	 * no-op by intent.
	 *
	 * `syncSoon` for the reason the main-variant choice fires it: a preference is
	 * a record, and taste that only reached one device is worse than none.
	 */
	async function chooseScale(next: string) {
		if (next !== 'rpe' && next !== 'rir') {
			return;
		}

		await exertionScale.choose(await getStore(), next);

		if (data.user) {
			syncSoon(data.user.id);
		}
	}

	const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

	// Whether this device holds a credential, which on the phone is the whole of
	// "signed in". Read from the client rather than from `data.user`, because the
	// two answer different questions: `data.user` is null for an unreachable
	// server too, and a sign-in form is not what that state needs.
	//
	// Derived on `data.user` because a load is what can change the answer behind
	// this screen's back: `request` drops a credential the server refused, and the
	// layout re-runs. The handlers below assign it directly for the window between
	// an action and the load it triggers — a derived value takes an override and
	// goes back to computing itself once its dependency moves.
	let credentialled = $derived.by(() => {
		void data.user;

		return deviceToken() !== null;
	});

	// ——— Account ———

	let signOutError = $state('');
	let signOutPending = $state(false);

	// Moved here from Start, unchanged in shape: no navigation on failure — the
	// credential is still live, so /login's reverse guard would bounce straight
	// back — and `invalidateAll` on the way out so the layout's session read
	// cannot be served from cache and revive an account without a credential.
	async function signOut() {
		signOutError = '';
		signOutPending = true;

		try {
			await logout();
		} catch (error) {
			signOutError = error instanceof ApiError ? error.message : 'could not sign out, try again';
			signOutPending = false;
			return;
		}

		// The phone has nowhere to be sent. Signing out there drops the device
		// token and leaves the app local-only — the state PRODUCT.md calls the
		// ordinary one — with the sign-in form appearing in this same section.
		// Navigating to `/login` would draw the web's card over a working app.
		if (import.meta.env.APP_BUILD) {
			credentialled = false;
			await invalidateAll();
			signOutPending = false;
			return;
		}

		await goto('/login', { invalidateAll: true, replaceState: true });
	}

	// ——— Server (app build only) ———

	// Mirrored into state because `apiBase()` is module memory the template
	// cannot track; connect and disconnect keep the mirror honest.
	let server = $state(apiBase());
	let address = $state('');
	let serverError = $state('');
	let connectPending = $state(false);
	let disconnectOpen = $state(false);

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
		server = base;

		// Connected, and not signed in — which is a complete state, not a
		// half-finished one. The section below turns into the sign-in form, and
		// `invalidateAll` is what asks the new server whether it offers Google.
		await invalidateAll();
		connectPending = false;
	}

	// Best-effort revocation before forgetting the address: a server that
	// cannot be reached to take the credential back must not be able to hold
	// the phone in the connected state. Local data is untouched either way —
	// disconnecting ends sync, not the records.
	async function disconnect() {
		try {
			await logout();
		} catch {
			// The credential outlives this on the server; its list is where it dies.
		}

		setApiBase(null);
		server = null;

		await invalidateAll();
	}

	// ——— Signing in (app build only) ———

	let email = $state('');
	let password = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let signInError = $state('');
	let signInPending = $state(false);
	let googlePending = $state(false);

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
	async function settle(user: Account) {
		credentialled = true;

		const store = await getStore();
		const owner = await store.owner();

		if (owner !== null && owner !== user.id) {
			arriving = user;
			mismatchOpen = true;
			return;
		}

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

		try {
			const user = await signInDevice(email.trim(), password);
			// Cleared on success only. A wrong password is retyped, not the address.
			password = '';
			await settle(user);
		} catch (error) {
			reportSignIn(error);
		}

		signInPending = false;
	}

	async function withGoogle() {
		signInError = '';
		googlePending = true;

		try {
			await settle(await signInWithGoogle());
		} catch (error) {
			reportSignIn(error);
		}

		googlePending = false;
	}

	// ——— Whose device is this (app build only) ———

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

		await invalidateAll();
	}

	$effect(() => {
		if (!mismatchOpen && arriving !== null) {
			void abandon();
		}
	});

	// ——— API tokens ———

	let createOpen = $state(false);
	let label = $state('');
	let labelError = $state('');
	let createPending = $state(false);

	/** The one window in which the cleartext exists — dismissed, it is gone. */
	let minted = $state<{ token: string; label: string } | null>(null);
	let copied = $state(false);

	async function create() {
		labelError = '';

		const trimmed = label.trim();
		if (trimmed === '') {
			labelError = 'give the token a label';
			return;
		}

		createPending = true;

		try {
			const { token, credential } = await createToken(trimmed);
			minted = { token, label: credential.label };
			copied = false;
			createOpen = false;
			label = '';

			await invalidateAll();
		} catch (error) {
			labelError = error instanceof ApiError ? error.message : 'could not create the token';
		}

		createPending = false;
	}

	async function copyMinted() {
		if (minted === null) {
			return;
		}

		try {
			await navigator.clipboard.writeText(minted.token);
			copied = true;
		} catch {
			// Clipboard access refused: the cleartext is on screen to copy by hand.
		}
	}

	let revoking = $state<PublicToken | null>(null);
	let revokeOpen = $state(false);
	let revokeError = $state('');

	async function revoke() {
		if (revoking === null) {
			return;
		}

		revokeError = '';

		try {
			await revokeToken(revoking.id);
			await invalidateAll();
		} catch (error) {
			revokeError = error instanceof ApiError ? error.message : 'could not revoke the token';
		}

		revoking = null;
	}
</script>

<svelte:head>
	<title>Settings | Kilorep</title>
</svelte:head>

<!-- Its own scroll pane, because Settings sits outside `(tabs)` and that layout
     is where every other screen gets one. It had none: a `min-h-full` column
     inside a `h-dvh` shell, which meant a long Settings page grew the document
     instead of scrolling a box — and, since the sliding rectangle used to be
     this column, made the one screen in the app whose transition had to resize
     itself on the way in. The box that slides is `(app)`'s now, identical
     everywhere, and this pane is an ordinary scroller inside it like every
     tab's. -->
<div class="min-h-0 flex-1 overflow-y-auto">
	<main class="column-content flex flex-col gap-6 px-3 pt-safe-t pb-4 lg:pt-0">
		<header class="flex flex-col gap-3 pt-3">
			<BackLink href="/workout" label="Back to workout" class="self-start" />

			<h1 class="px-1 text-2xl font-extrabold tracking-tight">Settings</h1>
		</header>

		<!-- First, and above the account: it is the only section here that answers to
		     the gym rather than to plumbing, and it exists whether or not a server
		     was ever connected. -->
		<section class="flex flex-col gap-3">
			<h2 class="px-1 label-caps text-ink-faint">Sets</h2>

			<div class="flex max-w-sm flex-col gap-3 px-1">
				<p class="text-md text-pretty text-ink-muted">
					How a set's optional rating is named. One number either way — the same set reads
					<span class="font-bold text-ink">RPE 8</span>
					or <span class="font-bold text-ink">RIR 2</span>, and changing this re-reads every set you
					have ever rated.
				</p>

				<ChipGroup
					bind:value={() => exertionScale.current, (next) => void chooseScale(next)}
					layout="row"
					label="Rating scale"
				>
					<Chip value="rpe">RPE</Chip>
					<Chip value="rir">RIR</Chip>
				</ChipGroup>
			</div>
		</section>

		{#if data.user}
			<section class="flex flex-col gap-3">
				<h2 class="px-1 label-caps text-ink-faint">Account</h2>

				<div class="flex max-w-sm flex-col gap-3 px-1">
					<p class="text-md break-all text-ink-muted">{data.user.email}</p>

					<Button variant="secondary" disabled={signOutPending} onclick={signOut}>
						{signOutPending ? 'Signing out…' : 'Sign out'}
					</Button>

					<div aria-live="polite">
						{#if signOutError !== ''}
							<p class="text-sm font-bold text-danger">{signOutError}</p>
						{/if}
					</div>
				</div>
			</section>
		{/if}

		{#if import.meta.env.APP_BUILD}
			<section class="flex flex-col gap-3">
				<h2 class="px-1 label-caps text-ink-faint">Server</h2>

				{#if server === null}
					<div class="flex max-w-sm flex-col gap-3 px-1">
						<p class="text-md text-pretty text-ink-muted">
							Everything lives on this phone. Connecting a self-hosted server adds sync, the web
							surface and the API.
						</p>

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
				{:else}
					<div class="flex max-w-sm flex-col gap-3 px-1">
						<p class="text-md break-all text-ink-muted">{server}</p>

						{#if !credentialled}
							<!-- Connected and signed out, which is a state the app runs in
						     rather than a door it stands behind: everything logged here
						     still works, and this form is how sync starts. -->
							<p class="text-md text-pretty text-ink-muted">
								Sign in to sync this phone with that server.
							</p>

							{#if data.google}
								<Button
									variant="secondary"
									disabled={googlePending || signInPending}
									onclick={withGoogle}
								>
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

							<Button
								variant="secondary"
								disabled={signInPending || googlePending}
								onclick={signIn}
							>
								{signInPending ? 'Signing in…' : 'Sign in'}
							</Button>

							<div aria-live="polite">
								{#if signInError !== ''}
									<p class="text-sm font-bold text-danger">{signInError}</p>
								{/if}
							</div>
						{/if}

						<Button variant="destructive" onclick={() => (disconnectOpen = true)}>
							<Plugs size={18} />
							Disconnect
						</Button>
					</div>

					<!-- Three-way, so a Sheet rather than the AlertDialog the rest of this
				     screen uses: the destructive option is one of the choices, not the
				     whole question, and it keeps its own confirm below. -->
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
									Every workout, template and weight on this phone is copied across. The other
									account keeps its own.
								</p>
							</div>

							<div class="flex flex-col gap-2">
								<Button variant="destructive" onclick={() => (wipeOpen = true)}>
									Erase this phone
								</Button>
								<p class="px-1 text-sm text-pretty text-ink-muted">
									Local data is deleted and replaced with whatever the new account has on the
									server.
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

					<AlertDialog
						bind:open={disconnectOpen}
						title="Disconnect this server?"
						description="Your workouts stay on this phone. Sync and the account stop until you connect again."
						confirmLabel="Disconnect"
						onconfirm={() => void disconnect()}
					/>
				{/if}
			</section>
		{/if}

		{#if data.tokens !== null}
			<section class="flex flex-col gap-3">
				<h2 class="px-1 label-caps text-ink-faint">API tokens</h2>

				{#if minted !== null}
					<!-- Never in the row it belongs to: the list shows hashes' shadows,
				     and this is the secret itself, once. -->
					<div class="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
						<p class="text-sm font-bold text-ink-muted">
							The token for “{minted.label}”. Copy it now — it is shown this once and stored only as
							a hash.
						</p>

						<code class="rounded-xl bg-surface-2 px-3 py-2 text-sm break-all">{minted.token}</code>

						<div class="flex gap-2">
							<Button variant="chrome" caps onclick={copyMinted}>
								{copied ? 'COPIED' : 'COPY'}
							</Button>
							<Button variant="chrome" caps onclick={() => (minted = null)}>DONE</Button>
						</div>
					</div>
				{/if}

				<ul class="list-group">
					{#each data.tokens as token (token.id)}
						<li>
							<ListRow
								title={token.label}
								meta={`${token.kind} · ${token.prefix}… · ${
									token.lastUsedAt === null
										? 'never used'
										: `last used ${day.format(token.lastUsedAt)}`
								}`}
							>
								{#snippet trailing()}
									{#if token.current}
										<Badge tone="accent">This session</Badge>
									{:else}
										<Button
											variant="chrome"
											caps
											onclick={() => {
												revoking = token;
												revokeOpen = true;
											}}
										>
											REVOKE
										</Button>
									{/if}
								{/snippet}
							</ListRow>
						</li>
					{/each}
				</ul>

				<div aria-live="polite">
					{#if revokeError !== ''}
						<p class="px-1 text-sm font-bold text-danger">{revokeError}</p>
					{/if}
				</div>

				<div class="px-1">
					<Button variant="secondary" onclick={() => (createOpen = true)}>New API token</Button>
				</div>

				<Sheet
					bind:open={createOpen}
					title="New API token"
					description="Authenticates a tool against the server. The secret is shown once."
				>
					<div class="flex flex-col gap-5 pt-2">
						<Input
							label="Label"
							name="label"
							placeholder="MCP on the desk"
							bind:value={label}
							error={labelError}
						/>

						<Button variant="secondary" disabled={createPending} onclick={create}>
							{createPending ? 'Creating…' : 'Create token'}
						</Button>
					</div>
				</Sheet>

				<AlertDialog
					bind:open={revokeOpen}
					title={`Revoke “${revoking?.label ?? ''}”?`}
					description="Whatever holds this token loses access immediately. There is no undo."
					confirmLabel="Revoke"
					onconfirm={() => void revoke()}
				/>
			</section>
		{/if}
	</main>
</div>
