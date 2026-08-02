<script lang="ts">
	/**
	 * The dashed grow-by-one silhouette: a list grows by one of the shape it
	 * already stacks, rather than sprouting a control of a kind it has nowhere
	 * else. One component because the templates list, the template editor, the
	 * session rail and the exercise block were each hand-copying the same
	 * twelve classes — and a silhouette that drifted per screen would stop
	 * reading as the same gesture.
	 *
	 * A row can carry a second act: the workout pane's blocks grow by a set
	 * almost always and by an exercise occasionally, and the occasional act
	 * rides the frequent one's row as a narrower segment rather than earning a
	 * row of its own under every block. One dashed outline, a dashed seam
	 * between the two — still one silhouette to the eye, two targets to the
	 * thumb.
	 *
	 * The `+` is a character, per the icons README: a glyph Nunito carries
	 * never becomes an SVG.
	 */
	type Props = {
		/** The act, without the `+` — "Add exercise", "New template". */
		label: string;
		onclick?: () => void;
		/** The narrower second act, without the `+` — "Exercise". */
		secondaryLabel?: string;
		onsecondary?: () => void;
	};

	let { label, onclick, secondaryLabel, onsecondary }: Props = $props();

	const segment =
		'grid min-h-row place-items-center focus-ring-inset hover:bg-surface-2 active:bg-surface-2';
</script>

{#if secondaryLabel !== undefined && onsecondary !== undefined}
	<div class="flex rounded-xl border border-dashed border-line text-ink-muted">
		<button type="button" {onclick} class="{segment} flex-1 rounded-l-xl">
			<span class="label-caps">+ {label}</span>
		</button>

		<button
			type="button"
			onclick={onsecondary}
			class="{segment} shrink-0 rounded-r-xl border-l border-dashed border-line px-5"
		>
			<span class="label-caps">+ {secondaryLabel}</span>
		</button>
	</div>
{:else}
	<button
		type="button"
		{onclick}
		class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
			text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
	>
		<span class="label-caps">+ {label}</span>
	</button>
{/if}
