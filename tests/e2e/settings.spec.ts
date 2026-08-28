import { test, expect } from '@playwright/test';
import { completeFirstRun } from './helpers';
import fs from 'node:fs';

test('首启选择持久化；设置页换流派与难度；导出→清→导入一致（SC-5、SC-9）', async ({ page }) => {
  await completeFirstRun(page, 'first-run-radio-jipinghu');

  // 首启选择持久化：刷新后不再出现引导
  await page.reload();
  await expect(page.getByTestId('first-run')).toHaveCount(0);

  // 设置页换流派与难度
  await page.goto('/settings');
  await page.getByTestId('settings-ruleset').selectOption('gangshi');
  await page.getByTestId('settings-difficulty').selectOption('expert');
  await expect(page.getByTestId('fan-table')).toBeVisible();

  // 导出
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-btn').click();
  const download = await downloadPromise;
  const backup = await download.path().then((p) => fs.readFileSync(p!, 'utf-8'));
  expect(JSON.parse(backup).v).toBe(1);

  // 清空存储（模拟清缓存）→ 重新出现首启引导
  await page.evaluate(() => indexedDB.deleteDatabase('gd-mahjong-trainer'));
  await page.reload();
  await expect(page.getByTestId('first-run')).toBeVisible();
  await page.getByTestId('first-run-confirm').click();
  await expect(page.getByTestId('first-run')).toHaveCount(0); // 等待设置写入完成

  // 导入备份 → 数据恢复（直接对隐藏 input 设置文件，不点按钮避免原生文件对话框）
  await page.goto('/settings');
  await page.setInputFiles('input[type=file]', {
    name: await download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf-8'),
  });
  await expect(page.getByTestId('settings-message')).toContainText('导入成功');

  await page.waitForURL(/\/settings/);
  await page.reload();
  await expect(page.getByTestId('first-run')).toHaveCount(0);
  await page.goto('/settings');
  await expect(page.getByTestId('settings-ruleset')).toHaveValue('gangshi');
  await expect(page.getByTestId('settings-difficulty')).toHaveValue('expert');
});
