import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.reject(new Error('隐私模式模拟：IndexedDB 打开失败'))),
}));

import { createLocalRepository } from '../../src/data/local-repository';
import type { Difficulty } from '../../src/domain/ai/types';

describe('IndexedDB 不可用降级', () => {
  it('降级为内存存储且 persistent=false，功能不拦截', async () => {
    const repo = await createLocalRepository('unreachable-db');
    expect(repo.persistent).toBe(false);
    await repo.saveSettings({
      rulesetId: 'tuidaohu',
      difficulty: 'novice' as Difficulty,
      hintEnabled: true,
      gamesUntilBackupHint: 20,
    });
    expect((await repo.getSettings())?.rulesetId).toBe('tuidaohu');
  });
});
