<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/**
	 * The generic tappable row: a template on Start, a workout in History, an
	 * exercise in the catalog, a destination in Settings.
	 *
	 * Navigation and actions only. It never carries a Switch — a control inside
	 * a clickable row is two elements competing for one tap — and Switch owns
	 * its own row for exactly that reason. SetRow stays separate too: it is
	 * welded to weight/reps/check and to the set's status, which is a domain
	 * shape rather than a layout.
	 *
	 * The element follows the job: `href` renders an anchor, `onclick` a button,
	 * and neither renders a plain div, so a row that does nothing is not
	 * announced as something to press.
	 *
	 * The chevron is `›`, a character — the subset carries it (measured: U+203A
	 * present), so per the icons README nothing is drawn.
	 */
	type Props = {
		title: string;
		/**
		 * The slice of `title` a search matched, marked with an underline so a
		 * result explains itself. Underline and not the accent: the accent means
		 * "this logs a set", and a matched substring is not that.
		 */
		match?: { start: number; end: number } | null;
		meta?: string;
		href?: string;
		onclick?: () => void;
		/** Suppress the chevron on a row that acts in place rather than navigating. */
		chevron?: boolean;
		/**
		 * A row whose tap toggles rather than fires, and where it stands — the
		 * picker's multi-select. Left undefined the row is an action, which is what
		 * every other row in the app is, and nothing is announced.
		 *
		 * The state itself is drawn by the caller in `trailing`: this is the button's
		 * half of it, and a row that looked selected without saying so is exactly
		 * the failure the attribute exists to prevent.
		 */
		pressed?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		class?: ClassValue;
	};

	let {
		title,
		match = null,
		meta,
		href,
		onclick,
		chevron = true,
		pressed,
		leading,
		trailing,
		class: klass
	}: Props = $props();

	const interactive = $derived(Boolean(href || onclick));

	// Three explicit elements rather than one `<svelte:element>`: the dynamic
	// form compiles to a tag the a11y checker cannot see, so it has to assume
	// the click handler landed on a `<div>` and warns. Spelling out the anchor
	// and the button says the same thing to the compiler that the props already
	// say to a reader.
	const shape = $derived([
		'flex min-h-row w-full items-center gap-3 rounded-xl px-3 py-2 text-left',
		interactive && 'focus-ring hover:bg-hover active:bg-surface-2',
		interactive && 'pointer-fine:transition-[background-color] pointer-fine:duration-100',
		klass
	]);
</script>

{#snippet body()}
	{#if leading}
		<span class="flex shrink-0 items-center text-ink-muted">{@render leading()}</span>
	{/if}

	<span class="min-w-0 flex-1">
		<span class="block truncate text-base font-extrabold tracking-tight text-ink">
			<!-- One line on purpose: whitespace between the slices would render. -->
			{#if match !== null}
				{title.slice(0, match.start)}<mark
					class="bg-transparent text-inherit underline decoration-2 underline-offset-2"
					>{title.slice(match.start, match.end)}</mark
				>{title.slice(match.end)}
			{:else}
				{title}
			{/if}
		</span>
		{#if meta}
			<span class="block truncate text-sm font-bold text-ink-faint">{meta}</span>
		{/if}
	</span>

	{#if trailing}
		<span class="flex shrink-0 items-center gap-2 text-md font-extrabold text-ink-muted">
			{@render trailing()}
		</span>
	{/if}

	{#if interactive && chevron}
		<span aria-hidden="true" class="shrink-0 text-xl leading-none text-ink-faint">›</span>
	{/if}
{/snippet}

<!-- `data-list-row` is how `list-group` finds the row it is wrapping: inside a
     card the row's own corners are squared and its focus ring turns inward, and
     the attribute survives the `<li>` and `<section>` wrappers the call sites
     put in between. A class would have to be threaded through every one of
     those. -->
{#if href}
	<a {href} data-list-row class={shape}>{@render body()}</a>
{:else if onclick}
	<button type="button" data-list-row aria-pressed={pressed} {onclick} class={shape}>
		{@render body()}
	</button>
{:else}
	<div data-list-row class={shape}>{@render body()}</div>
{/if}
