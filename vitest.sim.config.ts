import { defineConfig } from 'vitest/config';

// 千局模拟专用配置：`npm run test:sim`（耗时数分钟，CI 单独跑）
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/sim/**/*.test.ts'],
    hookTimeout: 60_000,
  },
});
