import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-live',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'msedge', headless: true, ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
});
