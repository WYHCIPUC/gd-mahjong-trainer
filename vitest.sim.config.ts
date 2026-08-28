import { defineConfig } from 'vitest/config';

// 千局模拟专用配置：`npm run test:sim`（耗时数分钟，CI 单独跑）
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/sim/**/*.test.ts'],
    // 千局模拟在 CI 2 核 runner 上可能跑 40–90 分钟，单测超时必须放宽
    testTimeout: 7_200_000,
    hookTimeout: 60_000,
  },
});
