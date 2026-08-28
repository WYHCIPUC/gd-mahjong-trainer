/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

// GitHub Pages 项目站点挂在 /<repo>/ 子路径下：CI 部署时设 PAGES_BASE=/<repo>/；
// 本地 Git Bash 会改写带前导斜杠的值，可传不带斜杠的形式（gd-mahjong-trainer）
const rawBase = process.env.PAGES_BASE ?? '/';
const base = rawBase.startsWith('/') ? rawBase : `/${rawBase.replace(/\/+$/, '')}/`;

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '广东麻将训练',
        short_name: '麻将训练',
        description: 'AI 陪练、知识学习与实时计算器三合一的广东麻将水平提高工具',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0a7d4f',
        background_color: '#f6f4ee',
        start_url: '.',
        scope: './',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // 纯静态应用：全部构建产物预缓存，无运行时外部请求
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SW 精确缓存到 base 前缀的导航请求（子路径部署时 index.html 也能离线命中）
        navigateFallbackDenylist: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    // 千局模拟耗时较长，拆分到 `npm run test:sim`
    exclude: [...configDefaults.exclude, 'tests/sim/**'],
  },
});

