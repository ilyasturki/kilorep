<!--
	The anterior silhouette every front-view body map is drawn on, faint. Not an
	icon and not exported as one: it has no `size` and no `viewBox`, because it
	is always rendered inside a muscle icon's own `<svg>`.

	One component rather than the path repeated in six files, which is the only
	way eleven figures stay optically identical — a hand-copied silhouette drifts
	in whichever file gets edited next, and the whole point of a family is that
	the *body* never moves and only the lit region does.

	The trunk is one mass here and two halves in `BodyBack`. That split is the
	sole thing distinguishing Biceps from Triceps and Quads from Hamstrings —
	same limb, same fill — so it is load-bearing rather than decorative, and it
	is why the section header renders these at 28px: measured, the channel is
	gone by 20px and the two pairs become the same icon.

	0.35 and not 0.3: below that the figure reads as a smudge under the lit
	region in light mode, where the label beside it is already `ink-faint`.
-->
<g opacity="0.35">
	<ellipse cx="128" cy="26" rx="21" ry="22" />
	<rect x="116" y="42" width="24" height="18" rx="9" />
	<ellipse cx="64" cy="86" rx="28" ry="24" />
	<ellipse cx="192" cy="86" rx="28" ry="24" />
	<path
		d="M102,54 H154 a24,24 0 0 1 24,24 v16 a30,30 0 0 1 -30,30 h-40 a30,30 0 0 1 -30,-30 v-16 a24,24 0 0 1 24,-24 z"
	/>
	<rect x="96" y="118" width="64" height="46" rx="15" />
	<path d="M92,160 H164 v12 a20,20 0 0 1 -20,20 h-32 a20,20 0 0 1 -20,-20 z" />
	<rect x="32" y="94" width="38" height="60" rx="19" />
	<rect x="186" y="94" width="38" height="60" rx="19" />
	<rect x="24" y="148" width="34" height="60" rx="17" />
	<rect x="198" y="148" width="34" height="60" rx="17" />
	<ellipse cx="41" cy="214" rx="16" ry="13" />
	<ellipse cx="215" cy="214" rx="16" ry="13" />
	<rect x="90" y="168" width="35" height="56" rx="17" />
	<rect x="131" y="168" width="35" height="56" rx="17" />
	<rect x="94" y="216" width="31" height="40" rx="15" />
	<rect x="131" y="216" width="31" height="40" rx="15" />
</g>
