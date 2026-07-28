<script lang="ts" module>
	/**
	 * The small caps pill: SUPERSET on an entry, WARMUP on a set row, PR on a
	 * best set.
	 *
	 * `accent` is the accent as a *fill* only in its soft form, with
	 * `accent-text` ink on top — the same pairing app.css reasons about for the
	 * SUPERSET badge. The badge never takes the full `--accent` fill, because
	 * that is reserved for the commit button and the selected chip, and a badge
	 * competing with the check is exactly the noise DESIGN.md rules out.
	 *
	 * All three tones name a token. `danger` used to be `bg-danger/12`, which
	 * cannot be right in both themes: `--danger` is red-600 in light and red-400
	 * in dark, so one alpha over it is two different fills.
	 */
	type Tone = 'neutral' | 'accent' | 'danger';

	const tones: Record<Tone, string> = {
		neutral: 'bg-surface-2 text-ink-muted',
		accent: 'bg-accent-soft text-accent-text',
		danger: 'bg-danger-soft text-danger'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	type Props = {
		tone?: Tone;
		class?: ClassValue;
		children: Snippet;
	};

	let { tone = 'neutral', class: klass, children }: Props = $props();
</script>

<span
	class={[
		'inline-flex items-center rounded-full px-2 py-0.5',
		'text-xs font-extrabold tracking-caps uppercase',
		tones[tone],
		klass
	]}
>
	{@render children()}
</span>
