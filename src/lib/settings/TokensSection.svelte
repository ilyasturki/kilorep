<script lang="ts">
	import { dateFormat } from '$lib/format/locale';
	import { invalidateAll } from '$app/navigation';

	import { createToken, renameToken, revokeToken } from '$lib/api/auth';
	import { ApiError, apiBase } from '$lib/api/client';
	import { claudeCommand, mcpServersJson } from '$lib/settings/mcp';
	import Section from '$lib/settings/Section.svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Input from '$lib/ui/Input.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Sheet from '$lib/ui/Sheet.svelte';

	import type { PublicToken } from '$lib/api/auth';

	type Props = {
		tokens: PublicToken[];
		minted: { token: string; label: string } | null;
	};

	let { tokens, minted = $bindable() }: Props = $props();

	const day = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });

	let copied = $state<'token' | 'command' | 'json' | null>(null);

	// The token is shown once and the address is needed every time, so the address lives here
	// rather than beside it. `apiBase` and not `location.origin`: on the phone the server is
	// wherever it was configured, which is the host a client has to be pointed at.
	const endpoint = $derived.by(() => {
		const base = apiBase();

		return base === null ? null : `${base}/api/mcp`;
	});

	let createOpen = $state(false);
	let label = $state('');
	let labelError = $state('');
	let createPending = $state(false);

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
			copied = null;
			createOpen = false;
			label = '';

			await invalidateAll();
		} catch (error) {
			labelError = error instanceof ApiError ? error.message : 'could not create the token';
		}

		createPending = false;
	}

	const setup = $derived(
		minted === null || endpoint === null
			? null
			: {
					command: claudeCommand(endpoint, minted.token),
					json: mcpServersJson(endpoint, minted.token)
				}
	);

	async function copy(what: 'token' | 'command' | 'json', text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
		} catch {
			/* empty */
		}
	}

	let held = $state<PublicToken | null>(null);
	let heldOpen = $state(false);
	let rename = $state('');
	let renameError = $state('');
	let renamePending = $state(false);

	function hold(token: PublicToken) {
		held = token;
		rename = token.label;
		renameError = '';
		heldOpen = true;
	}

	async function saveRename() {
		if (held === null) {
			return;
		}

		renameError = '';

		const trimmed = rename.trim();
		if (trimmed === '') {
			renameError = 'give the token a label';
			return;
		}

		renamePending = true;

		try {
			await renameToken(held.id, trimmed);
			heldOpen = false;

			await invalidateAll();
		} catch (error) {
			renameError = error instanceof ApiError ? error.message : 'could not rename the token';
		}

		renamePending = false;
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
			heldOpen = false;
			await invalidateAll();
		} catch (error) {
			revokeError = error instanceof ApiError ? error.message : 'could not revoke the token';
		}

		revoking = null;
	}
</script>

{#if minted !== null}
	{@const secret = minted.token}

	<div class="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
		<p class="text-sm font-bold text-ink-muted">
			The token for “{minted.label}”. Copy it now — it is shown this once and stored only as a hash.
		</p>

		<code class="rounded-xl bg-surface-2 px-3 py-2 text-sm break-all">{minted.token}</code>

		<div class="flex gap-2">
			<Button variant="chrome" caps onclick={() => void copy('token', secret)}>
				{copied === 'token' ? 'COPIED' : 'COPY'}
			</Button>
			<Button variant="chrome" caps onclick={() => (minted = null)}>DONE</Button>
		</div>

		{#if setup !== null}
			<div class="flex flex-col gap-2 pt-2">
				<div class="flex items-center justify-between gap-3">
					<span class="label-caps">Claude Code</span>
					<Button variant="chrome" caps onclick={() => void copy('command', setup.command)}>
						{copied === 'command' ? 'COPIED' : 'COPY'}
					</Button>
				</div>
				<code class="rounded-xl bg-surface-2 px-3 py-2 text-sm break-all">{setup.command}</code>
			</div>

			<div class="flex flex-col gap-2 pt-2">
				<div class="flex items-center justify-between gap-3">
					<span class="label-caps">Other clients · JSON</span>
					<Button variant="chrome" caps onclick={() => void copy('json', setup.json)}>
						{copied === 'json' ? 'COPIED' : 'COPY'}
					</Button>
				</div>
				<pre class="overflow-x-auto rounded-xl bg-surface-2 px-3 py-2 text-sm"><code
						>{setup.json}</code
					></pre>
			</div>
		{/if}
	</div>
{/if}

<Section title="API tokens">
	{#snippet action()}
		<Button variant="chrome" caps onclick={() => (createOpen = true)}>NEW</Button>
	{/snippet}

	{#each tokens as token (token.id)}
		<li>
			<ListRow
				stacked
				title={token.label}
				meta={`${token.kind} · ${token.prefix}… · ${
					token.lastUsedAt === null ? 'never used' : `last used ${day.format(token.lastUsedAt)}`
				}`}
				onclick={() => hold(token)}
			>
				{#snippet trailing()}
					{#if token.current}
						<Badge tone="accent">This session</Badge>
					{/if}
				{/snippet}
			</ListRow>
		</li>
	{/each}

	{#snippet footer()}
		{#if endpoint !== null}
			<p class="text-sm font-bold text-ink-faint">
				MCP answers at <code class="text-ink-muted">{endpoint}</code> — point a client there and send
				one of these as a bearer token.
			</p>
		{/if}

		<div aria-live="polite">
			{#if revokeError !== ''}
				<p class="text-sm font-bold text-danger">{revokeError}</p>
			{/if}
		</div>
	{/snippet}
</Section>

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

<Sheet
	bind:open={heldOpen}
	title={held?.label ?? ''}
	description={held?.current
		? 'The one this device is signed in with.'
		: 'Rename it, or revoke it to cut off whatever holds it.'}
>
	<div class="flex flex-col gap-5 pt-2">
		<Input label="Label" name="label" bind:value={rename} error={renameError} />

		<Button variant="secondary" disabled={renamePending} onclick={saveRename}>
			{renamePending ? 'Saving…' : 'Rename'}
		</Button>

		{#if held !== null && !held.current}
			<Button
				variant="destructive"
				onclick={() => {
					revoking = held;
					revokeOpen = true;
				}}
			>
				Revoke
			</Button>
		{/if}
	</div>
</Sheet>

<AlertDialog
	bind:open={revokeOpen}
	stacked={heldOpen}
	title={`Revoke “${revoking?.label ?? ''}”?`}
	description="Whatever holds this token loses access immediately. There is no undo."
	confirmLabel="Revoke"
	onconfirm={() => void revoke()}
/>
