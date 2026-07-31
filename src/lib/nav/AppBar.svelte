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
	 * It is a picture and not a link: the only destination it could plausibly
	 * have is `/`, which is the marketing page on the web and does not exist in
	 * the APK at all, so a clickable logo would either leave the app or go
	 * nowhere depending on which build you were standing in. Start is already a
	 * tab two inches to the right. It carries a real `alt` rather than the empty
	 * one the landing page and sign-in card give it — there, a wordmark follows
	 * and names the app; here nothing does.
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
	 * The bar renders on every app route, the Workout screen included. Hard rule
	 * 7 is a gym-floor rule — a nav target beside the commit button is a mis-tap
	 * waiting for a tired thumb — and a mouse on a desk does not trip it. While
	 * a session is live the first slot reads Workout instead of Start and wears
	 * the accent dot — the swap and its reasons live in `navTabs`.
	 */
	const slot = appBarSlot();
</script>

<header class="hidden shrink-0 border-b border-line-soft bg-surface pt-safe-t lg:block">
	<!-- The rail's width, so the column below inherits the same centring the
	     railed page gives its own content. -->
	<div class={slot.railed ? 'pl-60' : undefined}>
		<div class="column-content flex items-center gap-5 px-3 py-2">
			<img src={favicon} alt="Kilorep" class="size-5 shrink-0" />

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
	</div>
</header>
