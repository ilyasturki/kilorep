import type { Component } from 'svelte';

import type { MarkColour, MarkIcon } from '$lib/domain/template';
import ArrowFatDown from '$lib/ui/icons/ArrowFatDown.svelte';
import ArrowFatUp from '$lib/ui/icons/ArrowFatUp.svelte';
import Barbell from '$lib/ui/icons/Barbell.svelte';
import Fire from '$lib/ui/icons/Fire.svelte';
import Gauge from '$lib/ui/icons/Gauge.svelte';
import HandFist from '$lib/ui/icons/HandFist.svelte';
import Heartbeat from '$lib/ui/icons/Heartbeat.svelte';
import Lightning from '$lib/ui/icons/Lightning.svelte';
import Mountains from '$lib/ui/icons/Mountains.svelte';
import PersonSimpleBike from '$lib/ui/icons/PersonSimpleBike.svelte';
import PersonSimpleRun from '$lib/ui/icons/PersonSimpleRun.svelte';
import SneakerMove from '$lib/ui/icons/SneakerMove.svelte';
import Spiral from '$lib/ui/icons/Spiral.svelte';
import Star from '$lib/ui/icons/Star.svelte';
import Steps from '$lib/ui/icons/Steps.svelte';

export const MARK_GLYPHS: Record<MarkIcon, Component<{ size?: number; class?: string }>> = {
	push: ArrowFatUp,
	pull: ArrowFatDown,
	legs: SneakerMove,
	core: Spiral,
	grip: HandFist,
	barbell: Barbell,
	machine: Gauge,
	run: PersonSimpleRun,
	bike: PersonSimpleBike,
	heavy: Mountains,
	power: Lightning,
	burn: Fire,
	cardio: Heartbeat,
	steps: Steps,
	star: Star
};

export function markLabel(key: MarkIcon | MarkColour): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

// Literal class names, never `bg-tpl-${colour}-soft`: Tailwind's scanner does not generate interpolated classes.
export const MARK_TILES: Record<MarkColour, string> = {
	amber: 'bg-tpl-amber-soft text-tpl-amber',
	teal: 'bg-tpl-teal-soft text-tpl-teal',
	blue: 'bg-tpl-blue-soft text-tpl-blue',
	violet: 'bg-tpl-violet-soft text-tpl-violet',
	fuchsia: 'bg-tpl-fuchsia-soft text-tpl-fuchsia',
	slate: 'bg-tpl-slate-soft text-tpl-slate'
};

export const MARK_FILLS: Record<MarkColour, string> = {
	amber: 'bg-tpl-amber text-tpl-on',
	teal: 'bg-tpl-teal text-tpl-on',
	blue: 'bg-tpl-blue text-tpl-on',
	violet: 'bg-tpl-violet text-tpl-on',
	fuchsia: 'bg-tpl-fuchsia text-tpl-on',
	slate: 'bg-tpl-slate text-tpl-on'
};
