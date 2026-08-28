import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    viewport: { width: 390, height: 844 }, // 移动优先（NFR）
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
