# Android app ports the Lift identity, not the web screens

The Compose app reuses the Lift design system's visual identity — palette,
typography, radii, spacing, component skins — instead of stock Material 3
theming, so both surfaces read as one product. The screens themselves are NOT
ported: every flow, the gym loop above all, is redesigned for one-handed touch,
because cramped set logging and modal-heavy editing on mobile are what
motivated the native app in the first place (ADR-0001). Custom-skinned Compose
components keep native scroll physics, input latency, and keyboard handling,
so the brand costs us styling effort, not feel.

## Consequences

- We maintain a small Compose counterpart to the Lift tokens/components in
  `app/assets/css/main.css` and `app/components/ui`; token changes must be
  mirrored by hand.
- Stock Material idioms (dynamic color, default component looks) are
  deliberately not used; don't "fix" the theme back to Material defaults.
- Web layouts are not a spec for mobile screens — matching them is a
  non-goal.
