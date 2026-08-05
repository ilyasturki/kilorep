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

/**
 * Key to component, by ordinary static import.
 *
 * This is the map the icon README's no-dispatcher rule allows and the
 * `<Icon name="…">` component it forbids: every glyph is named in an import
 * at author time, so Vite still sees the exact set a screen can reach and
 * nothing is resolved from a string at runtime. The cost is that all fifteen
 * are in the bundle wherever this module is imported — which is correct, since
 * the picker can draw any of them and a list can hold all fifteen at once.
 *
 * Phosphor has no `squat` and no `hinge`, so the pattern set stops where the
 * family does and the remaining keys name equipment or intensity instead;
 * `barbell` and `machine` reuse glyphs already vendored for other screens.
 */
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

/**
 * What a key is called out loud: the key, title-cased.
 *
 * The picker is the one place a mark is named — on a row the tile is
 * `aria-hidden`, because the plan's name is already beside it — and there the
 * glyph and the hue *are* the choice, so each needs a word a reader can say.
 */
export function markLabel(key: MarkIcon | MarkColour): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Hue to the class pair that paints a tile: soft fill, saturated glyph.
 *
 * Literal strings and not `bg-tpl-${colour}-soft`, because Tailwind's scanner
 * reads source text and never runs this file — an interpolated class name is
 * a class that does not get generated. Same discipline as the glyph map above,
 * for a different tool.
 */
export const MARK_TILES: Record<MarkColour, string> = {
	amber: 'bg-tpl-amber-soft text-tpl-amber',
	teal: 'bg-tpl-teal-soft text-tpl-teal',
	blue: 'bg-tpl-blue-soft text-tpl-blue',
	violet: 'bg-tpl-violet-soft text-tpl-violet',
	fuchsia: 'bg-tpl-fuchsia-soft text-tpl-fuchsia',
	slate: 'bg-tpl-slate-soft text-tpl-slate'
};
