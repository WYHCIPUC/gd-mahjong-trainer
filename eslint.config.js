import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x';

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'coverage/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importXConfigs.recommended,
  {
    settings: {
      'import-x/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js'] },
      },
    },
  },
  // 领域层：零框架、零存储依赖，禁止依赖上层目录（设计文档·分层纪律）
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['react', 'react-dom', 'react-router*', 'idb', 'vitest'],
            message: '领域层零框架、零存储依赖',
          },
        ],
      }],
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: './src/domain', from: './src/ui', message: '领域层禁止依赖 UI 层' },
          { target: './src/domain', from: './src/app', message: '领域层禁止依赖应用层' },
          { target: './src/domain', from: './src/data', message: '领域层禁止依赖数据层' },
        ],
      }],
    },
  },
  // UI/应用层：只经 src/data/repository 接口访问存储
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/app/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/data/local-repository', '**/data/memory-repository', '**/data/repository.js'],
            message: 'UI/应用层只经 src/data/repository 接口访问存储' },
        ],
      }],
    },
  },
  // 唯一引导点：只有 store.ts 允许组装具体存储实现，其余 UI/应用层一律经 repository 接口
  {
    files: ['src/app/store.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    rules: {
      'import-x/no-unresolved': ['error', { ignore: ['virtual:'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
