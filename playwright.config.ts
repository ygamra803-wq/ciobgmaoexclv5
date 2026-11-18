import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const PREINSTALLED_HEADLESS_SHELL =
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';

const resolvedExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (fs.existsSync(PREINSTALLED_HEADLESS_SHELL) ? PREINSTALLED_HEADLESS_SHELL : undefined);

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: resolvedExecutablePath
      ? { executablePath: resolvedExecutablePath }
      : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
