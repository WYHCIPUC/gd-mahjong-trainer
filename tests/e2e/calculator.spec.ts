import { test, expect } from '@playwright/test';

const HAND13 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'z5', 'z5'];

test('计算器：摆 13 张 → 听牌面板 → 已见扣减 → 清空（SC-6）', async ({ page }) => {
  await page.goto('/calculator');
  await expect(page.getByTestId('tile-picker')).toBeVisible();

  for (const t of HAND13) {
    await page.getByTestId(`pick-${t}`).click();
  }

  await expect(page.getByTestId('calc-wait-p3')).toBeVisible();
  await expect(page.getByTestId('calc-result')).toContainText('剩 4 张');
  await expect(page.getByTestId('calc-result')).toContainText('合计 1 番');

  // 记录对手弃牌 p3 → 剩余张数 3
  await page.getByTestId('mode-seen').click();
  await page.getByTestId('pick-p3').click();
  await expect(page.getByTestId('calc-result')).toContainText('剩 3 张');

  // 清空
  await page.getByTestId('calc-clear').click();
  await expect(page.getByTestId('hand-tray')).toContainText('摆入');
  await expect(page.getByTestId('calc-result')).not.toContainText('合计');
});

test('鸡平胡流派切换后起胡提示出现', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByTestId('ruleset-select').selectOption('jipinghu');
  for (const t of HAND13) {
    await page.getByTestId(`pick-${t}`).click();
  }
  await expect(page.getByTestId('calc-hint')).toContainText('不满足 3 番起胡');
});
