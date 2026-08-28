import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 2 : 0, // CI 2 核 runner 偶发时序抖动
  workers: 1,
  use: {
    viewport: { width: 390, height: 844 }, // 移动优先（NFR）
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block', // 测试不验证离线缓存，屏蔽 SW 避免旧资源导致的抖动
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
