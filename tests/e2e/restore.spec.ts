import { test, expect } from '@playwright/test';
import { completeFirstRun, openPlay } from './helpers';

test('对局中刷新 → 提示恢复 → 从快照继续（SC-7）', async ({ page }) => {
  await completeFirstRun(page);
  await openPlay(page, '?seed=7');

  // 庄家打一张牌，推进到宣称窗口（等待轮到玩家：手牌可点击）
  const myTile = page.getByTestId('hand-tray').locator('button.tile-face').first();
  await myTile.waitFor({ state: 'visible', timeout: 15_000 });
  await myTile.click();
  const discardsBefore = await page.getByTestId('seat-0').textContent();

  await page.reload();
  await expect(page.getByTestId('resume-dialog')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('resume-yes').click();
  await expect(page.getByTestId('play-page')).toBeVisible();
  // 恢复后局面与刷新前一致（座位 0 的弃牌数仍在）
  await expect(page.getByTestId('seat-0')).toContainText((discardsBefore ?? '').trim());
});
