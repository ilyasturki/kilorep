<script lang="ts" module>
	type Tone = 'neutral' | 'accent' | 'danger';

	const tones: Record<Tone, string> = {
		neutral: 'bg-surface-2 text-ink-muted',
		accent: 'bg-accent-soft text-accent-text',
		danger: 'bg-danger-soft text-danger'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		tone?: Tone;
		children: Snippet;
	};

	let { tone = 'neutral', children }: Props = $props();
</script>

<span
	class={[
		'inline-flex items-center rounded-full px-2 py-0.5',
		'text-xs font-extrabold tracking-caps uppercase',
		tones[tone]
	]}
>
	{@render children()}
</span>
