import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // BD en memoria: las pruebas E2E nunca tocan tu data.sqlite real
    env: { PORT: '3000', DB_PATH: ':memory:' },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});