<script lang="ts">
	import { page } from '$app/state';

	import { appBarSlot, isActive, tabs } from '$lib/nav/bar.svelte';

	/**
	 * The top bar, from `lg` up and nowhere else. Below it the same tabs are a
	 * bar at the bottom of the screen — see `bar.svelte.ts` for why the swap is
	 * one navigation and not two.
	 *
	 * Wordmark, tabs, then the page's own action. The wordmark is text and not a
	 * link: the only destination it could plausibly have is `/`, which is the
	 * marketing page on the web and does not exist in the APK at all, so a
	 * clickable logo would either leave the app or go nowhere depending on which
	 * build you were standing in. Start is already a tab two inches to the right.
	 *
	 * It is set tighter and heavier than the tabs beside it rather than in
	 * `label-caps`, because a wordmark that matches the navigation it sits next
	 * to stops reading as a name and starts reading as a third tab.
	 *
	 * The bar renders on every app route, the Workout screen included. Hard rule
	 * 7 is a gym-floor rule — a nav target beside the commit button is a mis-tap
	 * waiting for a tired thumb — and a mouse on a desk does not trip it. There
	 * is no Workout tab, so Start reads as active while a session is live, which
	 * is true: Start's destination *is* the workout for as long as one exists.
	 */
	const slot = appBarSlot();
</script>

<header class="hidden shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:block">
	<!-- The rail's width, so the column below inherits the same centring the
	     railed page gives its own content. -->
	<div class={slot.railed ? 'pl-60' : undefined}>
		<div class="column-content flex items-center gap-6 px-3 py-2">
			<span class="shrink-0 text-base font-extrabold tracking-tight">Kilorep</span>

			<nav aria-label="Main" class="flex min-w-0 flex-1 items-center gap-1">
				{#each tabs as tab (tab.href)}
					{@const active = isActive(page.url.pathname, tab.href)}

					<a
						href={tab.href}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex min-h-chrome items-center rounded-xl px-3',
							'label-caps focus-ring',
							active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
						]}
					>
						{tab.label}
					</a>
				{/each}
			</nav>

			{#if slot.action !== null}
				{@render slot.action()}
			{/if}
		</div>
	</div>
</header>
