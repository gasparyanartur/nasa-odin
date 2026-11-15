import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1,
  use: {
    actionTimeout: 20_000,
    baseURL: 'http://127.0.0.1:8274',
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    { command: 'MARTIAN_STATIC_DIR=dist node scripts/python.mjs -m uvicorn server.app:app --host 127.0.0.1 --port 8274', url: 'http://127.0.0.1:8274/api/health', reuseExistingServer: false },
  ],
});
