import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-chunks',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5186', headless: true, ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'msedge' }) },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
