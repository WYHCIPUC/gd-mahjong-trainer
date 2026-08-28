import { test, expect } from '@playwright/test';
import { completeFirstRun } from './helpers';

test('学习中心：番种表、章节练习判分与错题本、随机练习（SC-8）', async ({ page }) => {
  await completeFirstRun(page);
  await page.goto('/learn');
  await expect(page.getByTestId('learn-page')).toBeVisible();

  // 番种表
  await expect(page.getByTestId('fan-table-body')).toContainText('起胡');

  // 章节练习：选第一个选项 → 出反馈
  await page.getByTestId('learn-tab-quiz').click();
  const feedback = page.locator('[data-testid^="feedback-"]').first();
  await page.locator('[data-testid^="opt-"]').first().click();
  await expect(feedback).toBeVisible({ timeout: 5_000 });

  // 随机练习可出题
  await page.getByTestId('learn-tab-random').click();
  await page.getByTestId('random-next').click();
  await expect(page.locator('[data-testid^="quiz-gen-"]').first()).toBeVisible();

  // 错题本页面可达
  await page.getByTestId('learn-tab-mistakes').click();
  await expect(page.getByTestId('mistakes-body')).toBeVisible();
});
