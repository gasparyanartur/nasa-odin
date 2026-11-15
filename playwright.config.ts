import { defineConfig } from '@playwright/test';

const port=process.env.TEST_PORT??'8273';
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1,
  use: {
    actionTimeout: 20_000,
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
    launchOptions: { args: process.env.TEST_HARDWARE==='1'?['--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    { command: `node scripts/serve-static.mjs --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
  ],
});
