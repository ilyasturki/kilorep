# Native Kotlin/Compose Android app, superseding the PWA-as-mobile-strategy

The PWA plan originally positioned the installable web app as the replacement for a
native Android app. In practice the mobile experience falls short at the gym — the
primary usage surface: set logging is fiddly, navigation suits desktop more than
one-handed thumb use, and the app retains a browser feel. We decided to build a
native Kotlin/Compose Android app consuming the Nitro backend.

## Considered Options

- **Mobile-first redesign of the PWA** — rejected: even with redesigned screens, we
  believe Android web rendering has a feel ceiling (input latency, scroll physics,
  keyboard handling) that the primary surface should not be capped by.
- **Capacitor wrapper** — rejected: still a WebView, so it inherits the same ceiling
  while adding a shell to maintain.
- **Native Kotlin/Compose** — chosen, accepting the cost of a permanent second UI
  codebase and the auth work the backend needs to support a non-cookie client.

## Consequences

- The mobile screens must be redesigned regardless of vehicle; that design work now
  lands in Compose rather than in the web app.
- The web app remains the desktop surface. Mobile-web UX investment stops, and the
  PWA machinery (@vite-pwa, service worker, offline caching) is retired once the
  native app is stable enough to be the daily driver.
- The backend's bearer-token auth (currently `/mcp`-only) must be extended or an
  alternative native auth path designed before the app can ship.
