import { expect, type Page } from '@playwright/test';

/** 每个测试都是全新浏览器上下文（无 IndexedDB），先完成首启引导。
 *  「开始使用」→ 引导页消失即代表设置已写入（onDone 在 await saveSettings 之后触发），
 *  后续 goto 才不会丢设置。 */
export async function completeFirstRun(page: Page, radioTestId?: string): Promise<void> {
  await page.goto('/');
  const firstRun = page.getByTestId('first-run');
  if (await firstRun.isVisible().catch(() => false)) {
    if (radioTestId) await page.getByTestId(radioTestId).check();
    await page.getByTestId('first-run-confirm').click();
    await expect(firstRun).toHaveCount(0);
  }
}
