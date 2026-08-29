/**
 * 生成 README 用界面截图：docs/screenshots/*.png
 * 用法：先 npm run build，再 npx tsx scripts/screenshots.ts 或 node scripts/screenshots.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

function startPreview() {
  // stdio: 'ignore' 防止孤儿 vite 进程持有本进程的管道（tail/CI 会永远等 EOF）
  const proc = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { shell: true, stdio: 'ignore' },
  );
  const killTree = () => {
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGTERM');
  };
  return { done: new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(poller);
      killTree();
      reject(new Error('preview 启动超时'));
    }, 30_000);
    const poller = setInterval(async () => {
      try {
        const res = await fetch(BASE);
        if (res.ok) {
          clearInterval(poller);
          clearTimeout(timer);
          resolve(proc);
        }
      } catch {
        /* 未就绪，继续轮询 */
      }
    }, 300);
    proc.on('exit', (code) => {
      clearInterval(poller);
      clearTimeout(timer);
      if (code) reject(new Error(`preview 退出：${code}`));
    });
  }), killTree };
}

const HAND = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 's1', 's2', 's3', 'z1'];

async function capture(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

const { done: previewReady, killTree } = startPreview();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();

  // 首启引导
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByTestId('first-run').waitFor();
  await capture(page, 'first-run');

  // 选流派进入首页
  await page.getByTestId('first-run-confirm').click();
  await page.getByTestId('home-card-play').waitFor();
  await capture(page, 'home');

  // 陪练对局：自动演示模式打到中盘（弃牌池有内容）再截
  await page.getByTestId('home-card-play').click();
  await page.goto(`${BASE}/play?auto=1&seed=42`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('play-page').waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="discard-pool-"] .tile-face').length >= 12,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(800);
  await capture(page, 'play');

  // 计算器：摆一手听牌（万子清一色听字牌）
  await page.goto(`${BASE}/calculator`, { waitUntil: 'networkidle' });
  await page.getByTestId('tile-picker').waitFor();
  for (const t of HAND) {
    const btn = page.getByTestId(`pick-${t}`);
    if (await btn.isEnabled()) await btn.click();
  }
  await page.getByTestId('calc-result').waitFor();
  await page.getByTestId('calc-result').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await capture(page, 'calculator');

  // 学习中心（番种表 tab）
  await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' });
  await page.getByTestId('learn-page').waitFor();
  await page.waitForTimeout(500);
  await capture(page, 'learn');

  await ctx.close();
} finally {
  await browser.close();
  killTree();
}
console.log('完成');
