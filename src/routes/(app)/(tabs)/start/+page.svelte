<script lang="ts">
	import { goto } from '$app/navigation';

	import { logout } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import type { Template } from '$lib/domain/template';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import Stack from '$lib/ui/icons/Stack.svelte';

	import type { PageProps } from './$types';

	/**
	 * The template list, plus the empty-workout action — what PRODUCT.md says
	 * fills this address once a live session stops claiming it.
	 *
	 * A template row opens its editor, where Start lives; it does not start the
	 * workout itself. The immediate-start rule was weighed and retired — see
	 * PRODUCT.md's Start section — because one row cannot honestly carry both
	 * "open this plan" and "begin lifting now", and a mis-tap that starts a
	 * workout costs more than the tap it saved.
	 *
	 * "New template" navigates before any record exists: the editor owns the
	 * blank-birth rule and writes nothing until the plan says something, so a
	 * mis-tap here leaves no junk behind. The id is minted now because the
	 * route is the id.
	 */
	let { data }: PageProps = $props();

	let signOutError = $state('');
	let pending = $state(false);

	function planned(template: Template): string {
		const count = template.entries.flatMap((entry) => entry.exercises).length;

		if (count === 0) {
			return 'No exercises yet';
		}

		return count === 1 ? '1 exercise' : `${count} exercises`;
	}

	async function signOut() {
		signOutError = '';
		pending = true;

		try {
			await logout();
		} catch (error) {
			// Deliberately no navigation on failure. Leaving for `/login` would
			// look like a sign-out and be none: the credential is still live, so
			// the reverse guard there would read the session and send this screen
			// straight back, having told nobody why.
			signOutError = error instanceof ApiError ? error.message : 'could not sign out, try again';
			pending = false;
			return;
		}

		// `invalidateAll` so the layout's session read cannot be served from
		// cache and revive an account that no longer has a credential.
		await goto('/login', { invalidateAll: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>Start | Kilorep</title>
</svelte:head>

<!--
	`column-content` now, not the placeholder's `column-action`: this screen
	stopped being one decision the moment the list landed. The empty-workout
	action still sits in the thumb zone on a phone — `flex-1` on the section
	above pushes it there — because it is the one thing here pressed mid-stride
	on a gym floor; the list is read standing still.
-->
<main class="column-content flex min-h-full flex-col gap-5 px-3 pt-safe-t pb-4 lg:pt-0">
	<header class="flex flex-col gap-1.5 pt-10 lg:pt-6">
		<!-- The bar above carries the wordmark from `lg` up; twice on one screen
		     is once too many. -->
		<h1 class="text-2xl font-extrabold tracking-tight lg:hidden">Kilorep</h1>

		{#if data.user}
			<p class="text-md break-all text-ink-muted">{data.user.email}</p>
		{/if}
	</header>

	<section class="flex flex-1 flex-col gap-1">
		<h2 class="px-3 label-caps text-ink-faint">Templates</h2>

		{#if data.templates.length === 0}
			<EmptyState
				title="No templates yet"
				description="Plan a session once, start it every gym day."
			>
				{#snippet icon()}
					<Stack size={24} />
				{/snippet}
			</EmptyState>
		{:else}
			{#each data.templates as template (template.id)}
				<!-- A persisted template can be nameless — named-nothing but planned-
				     something escapes the blank rule — and a row with no title reads
				     as a bug, not a choice. -->
				<ListRow
					title={template.name.trim() === '' ? 'Untitled' : template.name}
					meta={planned(template)}
					href="/templates/{template.id}"
				/>
			{/each}
		{/if}

		<!-- The same dashed silhouette every list in the app grows by. `+` is a
		     character, per the icons README. -->
		<button
			type="button"
			onclick={() => void goto(`/templates/${crypto.randomUUID()}`)}
			class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
				text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
		>
			<span class="label-caps">+ New template</span>
		</button>
	</section>

	<div class="flex flex-col gap-3">
		<!--
			The one filled button on the screen, per Button's own rule. Resume gets
			the commit slot when a snapshot survived a reload: walking back into a
			half-logged session is the most likely reason to be standing here.
		-->
		<Button variant="commit" href="/workout">
			{data.resuming ? 'Resume workout' : 'Start empty workout'}
		</Button>

		{#if data.user}
			<Button variant="secondary" disabled={pending} onclick={signOut}>
				{pending ? 'Signing out…' : 'Sign out'}
			</Button>

			<div aria-live="polite">
				{#if signOutError !== ''}
					<p class="text-sm font-bold text-danger">{signOutError}</p>
				{/if}
			</div>
		{/if}
	</div>
</main>
