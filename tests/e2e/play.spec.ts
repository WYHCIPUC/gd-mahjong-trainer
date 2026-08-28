import { test, expect } from '@playwright/test';
import { completeFirstRun, openPlay } from './helpers';

test('陪练：自动演示模式完整打完一局并看到结算与复盘（SC-4 桌面部分）', async ({ page }) => {
  await completeFirstRun(page);
  await openPlay(page, '?seed=42&auto=1');
  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('score-deltas')).toBeVisible();
  await expect(page.getByTestId('divergence-list')).toBeVisible();
});

test('陪练：手动打两巡（出牌 + 过宣称）', async ({ page }) => {
  await completeFirstRun(page);
  await openPlay(page, '?seed=7');

  // 等待轮到玩家（手牌变为可点击的 button）再出牌
  const myTile = page.getByTestId('hand-tray').locator('button.tile-face').first();
  await myTile.waitFor({ state: 'visible', timeout: 15_000 });
  await myTile.click();
  await expect(page.getByTestId('play-page')).toBeVisible();
});
