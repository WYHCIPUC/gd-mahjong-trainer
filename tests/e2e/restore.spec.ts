import { test, expect } from '@playwright/test';
import { completeFirstRun } from './helpers';

test('对局中刷新 → 提示恢复 → 从快照继续（SC-7）', async ({ page }) => {
  await completeFirstRun(page);
  await page.goto('/play?seed=7');
  await expect(page.getByTestId('play-page')).toBeVisible();

  // 庄家打一张牌，推进到宣称窗口
  await page.getByTestId('hand-tray').locator('.tile-face').first().click();
  const discardsBefore = await page.getByTestId('seat-0').textContent();

  await page.reload();
  await expect(page.getByTestId('resume-dialog')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('resume-yes').click();
  await expect(page.getByTestId('play-page')).toBeVisible();
  // 恢复后局面与刷新前一致（座位 0 的弃牌数仍在）
  await expect(page.getByTestId('seat-0')).toContainText(discardsBefore ?? '');
});
