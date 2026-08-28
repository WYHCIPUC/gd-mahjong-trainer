import { expect, type Page } from '@playwright/test';

/** App 异步判定「是否有设置」期间渲染空态（first-run 计数为 0 但马上可能变 1）。
 *  必须等底部导航渲染（设置判定已完成的正面指标）后再做后续断言。 */
export async function expectAppReady(page: Page): Promise<void> {
  await expect(page.locator('.bottom-nav')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('first-run')).toHaveCount(0);
}

/** 关闭首启引导（若出现）。返回是否出现过。 */
async function dismissFirstRun(page: Page, radioTestId?: string): Promise<boolean> {
  const firstRun = page.getByTestId('first-run');
  if (!(await firstRun.isVisible().catch(() => false))) return false;
  if (radioTestId) await page.getByTestId(radioTestId).check();
  await page.getByTestId('first-run-confirm').click();
  await expect(firstRun).toHaveCount(0);
  return true;
}

/**
 * 每个测试都是全新浏览器上下文（无 IndexedDB），先完成首启引导。
 * 极少数情况下新上下文的 IDB 首写不落盘，刷新后引导会再出现——循环确认（最多 3 次）。
 */
export async function completeFirstRun(page: Page, radioTestId?: string): Promise<void> {
  await page.goto('/');
  for (let i = 0; i < 3; i++) {
    const dismissed = await dismissFirstRun(page, i === 0 ? radioTestId : undefined);
    if (!dismissed) break;
    await page.reload();
    await expectAppReady(page);
  }
  await expectAppReady(page);
}

/** 进入对局页：关掉可能出现的首启引导与「未完成对局」询问。 */
export async function openPlay(page: Page, query = ''): Promise<void> {
  await page.goto(`/play${query}`);
  const firstRun = page.getByTestId('first-run');
  if (await firstRun.isVisible().catch(() => false)) {
    await page.getByTestId('first-run-confirm').click();
    await expect(firstRun).toHaveCount(0);
  }
  const resumeDialog = page.getByTestId('resume-dialog');
  if (await resumeDialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await page.getByTestId('resume-no').click();
  }
  await expect(page.getByTestId('play-page')).toBeVisible();
}
