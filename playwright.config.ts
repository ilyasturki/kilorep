import { defineConfig } from '@playwright/test';

import { WEB_URL } from './e2e/env.ts';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	globalTeardown: './e2e/teardown.ts',

	use: {
		baseURL: WEB_URL,
		locale: 'en-US',
		trace: 'retain-on-failure',
		launchOptions: {
			// NixOS cannot run the browsers Playwright downloads.
			executablePath: process.env.PLAYWRIGHT_CHROMIUM
		}
	},

	projects: [
		{
			name: 'phone',
			grepInvert: /@desk/u,
			use: { viewport: { width: 420, height: 860 }, hasTouch: true, isMobile: true }
		},
		{
			name: 'desk',
			grepInvert: /@phone/u,
			use: { viewport: { width: 1280, height: 800 } }
		}
	],

	webServer: {
		command: 'node e2e/serve.ts',
		url: `${WEB_URL}/api/health`,
		reuseExistingServer: false,
		timeout: 5 * 60 * 1000
	}
});
