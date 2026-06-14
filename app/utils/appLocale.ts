import { ref } from 'vue'

// The locale every number/date formatter and reka's ConfigProvider read.
// A plain module ref (not useState) so the pure util formatters can read it
// without a Nuxt context; plugins/locale.client.ts seeds it from the user's
// saved preference and Settings updates it live, reformatting the whole app.
// All formatting runs on ssr:false pages, so a module-level ref can't leak
// across requests. undefined = follow the device (Intl/reka pick the default).
export const appLocale = ref<string | undefined>(undefined)
