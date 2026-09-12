import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:4310';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  retries: 1,
  workers: 1,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'pnpm nx serve census-mobile-frontend --configuration=development --port=4310 --host=127.0.0.1',
    url: 'http://127.0.0.1:4310',
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium-320',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 800 },
      },
    },
    {
      // Temporary alias for the #106 one-shot validator. Removed after the
      // validated feature commit lands; it is behaviorally identical to chromium-320.
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 800 },
      },
    },
  ],
});
