import { defineConfig } from '@playwright/test';

const baseURL = process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:3000';
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  webServer: process.env.PLAYWRIGHT_START_SERVERS === '1' ? [
    {
      command: 'npm run start -w @gear-drop/api',
      url: new URL('/products/field-75', apiURL).href,
    },
    {
      command: 'npm run start -w @gear-drop/web -- --hostname 127.0.0.1',
      url: baseURL,
    },
  ] : undefined,
  use: {
    baseURL,
    channel: process.env.BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
});
