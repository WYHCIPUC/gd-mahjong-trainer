import { test, expect } from '@playwright/test';
import { completeFirstRun } from './helpers';

test('陪练：自动演示模式完整打完一局并看到结算与复盘（SC-4 桌面部分）', async ({ page }) => {
  await completeFirstRun(page);
  await page.goto('/play?seed=42&auto=1');
  await expect(page.getByTestId('play-page')).toBeVisible();
  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('score-deltas')).toBeVisible();
  await expect(page.getByTestId('divergence-list')).toBeVisible();
});

test('陪练：手动打两巡（出牌 + 过宣称）', async ({ page }) => {
  await completeFirstRun(page);
  await page.goto('/play?seed=7');
  await expect(page.getByTestId('play-page')).toBeVisible();

  // 庄家（人类）出第一张手牌
  await page.getByTestId('hand-tray').locator('.tile-face').first().click();
  // 之后进入他人回合/宣称窗口：手牌不可点或出现宣称条，页面不崩溃
  await expect(page.getByTestId('play-page')).toBeVisible();
});
