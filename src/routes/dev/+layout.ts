// Dev-only surfaces (the component styleguide). They render app components, so
// they need the app's rendering mode — Bits UI's Sheet is verified under
// `ssr = false` and nothing here has ever run on a server.
//
// Deliberately not inside the `(app)` group: that layout is where the app's
// chrome will live, and a styleguide wearing a tab bar is worse than one
// duplicated directive.
export const ssr = false;
export const prerender = false;
