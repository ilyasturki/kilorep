<script lang="ts">
	import { page } from '$app/state';

	import favicon from '$lib/assets/favicon.svg';
	import { appBarSlot, isActive, navTabs } from '$lib/nav/bar.svelte';

	/**
	 * The top bar, from `lg` up and nowhere else. Below it the same tabs are a
	 * bar at the bottom of the screen — see `bar.svelte.ts` for why the swap is
	 * one navigation and not two.
	 *
	 * Mark, tabs, then the page's own action. The mark is the rest ring and not
	 * the word: set beside the tabs, "kilorep" at 16px tight extrabold against
	 * an 11px tracked cap was two typefaces having an argument, and the fix that
	 * survives is to stop setting the name in type here at all. The ring is
	 * already the app's face on the launcher, the favicon and the sign-in card,
	 * so the bar says the same thing in the register the other three use.
	 *
	 * The mark is a link to home, which is the Workout tab — the logo-goes-home
	 * convention, pointed at the same address in both builds. It was a plain
	 * picture while home was `/`: the marketing page on the web, nothing at all
	 * in the APK, so a clickable logo would have left the app or gone nowhere
	 * depending on which build you were standing in. `/workout` exists in both.
	 * The accessible name is on the link, per the icons contract; the image
	 * underneath is decoration to a reader, so its `alt` is empty here unlike
	 * the landing page and sign-in card, where the mark stands unlabelled in
	 * flowing content.
	 *
	 * The tabs are 14px sentence case, which is the other half of the same fix:
	 * `label-caps` is the app's *section heading* voice, and a destination you
	 * press is not a heading. The selected one wears a `nav-selected` pill and
	 * the fill-weight glyph; hover is the same pill one step lighter at
	 * `nav-hover`, gated on `pointer-fine` so a touchscreen laptop cannot leave
	 * it stuck on after a tap. Those two are a named pair because no existing
	 * depth token is one clean step from the bar in both themes — `app.css` has
	 * the measurement. Neutral and not lime on purpose: the accent means "this
	 * logs a set", and the live dot is the only thing in either bar entitled
	 * to it.
	 *
	 * The bar renders on every app route, the Workout screen included, in every
	 * state of it. So does the phone's now — the `(tabs)` layout used to drop
	 * its bar mid-session and no longer does, for the reason recorded there —
	 * so the two ends agree again and there is no width at which a live session
	 * is a screen with no way out. The live one wears the accent dot; that swap
	 * and its reasons live in `navTabs`.
	 */
	const slot = appBarSlot();
</script>

<header class="hidden shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:block">
	<!-- The same cap and the same centring as the page under it, on every route:
	     the Workout rail floats in the gutter now and takes no width from the
	     column, so there is nothing left that offsets one and not the other. -->
	<div class="column-content flex items-center gap-5 px-3 py-2">
		<a
			href="/workout"
			aria-label="Kilorep — workout"
			class="grid shrink-0 place-items-center rounded-md focus-ring"
		>
			<img src={favicon} alt="" class="size-5" />
		</a>

		<nav aria-label="Main" class="flex min-w-0 flex-1 items-center gap-1">
			{#each navTabs() as tab (tab.href)}
				{@const active = isActive(page.url.pathname, tab.href)}
				{@const Icon = (active && tab.iconActive) || tab.icon}

				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class={[
						'flex min-h-chrome items-center gap-2 rounded-xl px-3',
						'text-md font-bold focus-ring transition-colors',
						active
							? 'bg-nav-selected text-ink'
							: 'text-ink-faint pointer-fine:hover:bg-nav-hover pointer-fine:hover:text-ink-muted'
					]}
				>
					<Icon size={18} class="shrink-0" />
					{tab.label}
					{#if tab.live}
						<span class="size-1.5 rounded-full bg-accent"></span>
					{/if}
				</a>
			{/each}
		</nav>

		{#if slot.action !== null}
			{@render slot.action()}
		{/if}
	</div>
</header>
