<!--
	The anterior silhouette every front-view body map is drawn on, faint. Not an
	icon and not exported as one: it has no `size` and no `viewBox`, because it
	is always rendered inside a muscle icon's own `<svg>`.

	One component rather than the shapes repeated in six files, which is the only
	way eleven figures stay optically identical — a hand-copied silhouette drifts
	in whichever file gets edited next, and the whole point of a family is that
	the *body* never moves and only the lit region does.

	The figure is composed from overlapping organic parts — a curved torso path,
	tilted tapering limb capsules, deltoid caps — and the overlaps are free:
	`opacity` sits on the group, so the union composites once and no seam ever
	shows. That is also why the limbs may tuck under the deltoids and the thighs
	under the pelvis instead of being fitted edge-to-edge.

	The trunk is one mass here and two halves in `BodyBack`. That split is the
	sole thing distinguishing Biceps from Triceps and Quads from Hamstrings —
	same limb, same fill — so it is load-bearing rather than decorative, and it
	is why the section header renders these at 28px: measured in headless
	Chromium, the 10px channel reads at 28px and is gone by ~20.

	0.35 and not 0.3: below that the figure reads as a smudge under the lit
	region in light mode, where the label beside it is already `ink-faint`.
-->
<g opacity="0.35">
	<ellipse cx="128" cy="25" rx="16" ry="18" />
	<rect x="119" y="40" width="18" height="13" rx="5" />
	<path
		d="M115,48 C102,51 92,55 86,63 C82,70 81,80 83,90 C85,104 91,115 97,124
		C101,131 103,140 102,150 C101,160 103,167 109,172 C115,177 121,179 128,179
		C135,179 141,177 147,172 C153,167 155,160 154,150 C153,140 155,131 159,124
		C165,115 171,104 173,90 C175,80 174,70 170,63 C164,55 154,51 141,48 Z"
	/>
	<ellipse cx="74" cy="64" rx="13" ry="12" />
	<ellipse cx="182" cy="64" rx="13" ry="12" />
	<rect x="57" y="68" width="18" height="46" rx="9" transform="rotate(6 66 91)" />
	<rect x="181" y="68" width="18" height="46" rx="9" transform="rotate(-6 190 91)" />
	<rect x="51" y="112" width="15" height="46" rx="7.5" transform="rotate(8 58.5 135)" />
	<rect x="190" y="112" width="15" height="46" rx="7.5" transform="rotate(-8 197.5 135)" />
	<ellipse cx="52" cy="165" rx="7.5" ry="9.5" transform="rotate(8 52 165)" />
	<ellipse cx="204" cy="165" rx="7.5" ry="9.5" transform="rotate(-8 204 165)" />
	<rect x="98" y="163" width="27" height="58" rx="13" />
	<rect x="131" y="163" width="27" height="58" rx="13" />
	<rect x="101" y="213" width="21" height="36" rx="10" />
	<rect x="134" y="213" width="21" height="36" rx="10" />
	<ellipse cx="106" cy="249" rx="12" ry="6.5" />
	<ellipse cx="150" cy="249" rx="12" ry="6.5" />
</g>
