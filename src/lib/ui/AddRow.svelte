<script lang="ts">
	/**
	 * The dashed grow-by-one silhouette: a list grows by one of the shape it
	 * already stacks, rather than sprouting a control of a kind it has nowhere
	 * else. One component because the templates list, the template editor, the
	 * session rail and the exercise block were each hand-copying the same
	 * twelve classes — and a silhouette that drifted per screen would stop
	 * reading as the same gesture.
	 *
	 * The `+` is a character, per the icons README: a glyph Nunito carries
	 * never becomes an SVG.
	 */
	type Props = {
		/** The act, without the `+` — "Add exercise", "New template". */
		label: string;
		onclick?: () => void;
	};

	let { label, onclick }: Props = $props();
</script>

<button
	type="button"
	{onclick}
	class="grid min-h-row place-items-center rounded-xl border border-dashed border-line
		text-ink-muted focus-ring hover:bg-surface-2 active:bg-surface-2"
>
	<span class="label-caps">+ {label}</span>
</button>
