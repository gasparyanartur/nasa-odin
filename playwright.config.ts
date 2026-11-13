import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8273',
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    { command: 'MARTIAN_STATIC_DIR=dist .venv/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8273', url: 'http://127.0.0.1:8273/api/health', reuseExistingServer: false },
  ],
});
