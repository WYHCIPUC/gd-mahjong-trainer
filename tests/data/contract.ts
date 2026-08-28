// Repository 契约测试：Memory 与 Local（IndexedDB）实现共用同一套断言，
// 保证两种实现行为一致（换实现不动业务层的底气）。
import { expect, it, describe } from 'vitest';
import type { Repository } from '../../src/data/repository';

export function runRepositoryContractTests(name: string, make: () => Promise<Repository>): void {
  describe(`Repository 契约：${name}`, () => {
    it('设置读写', async () => {
      const repo = await make();
      expect(await repo.getSettings()).toBeNull();
      await repo.saveSettings({ rulesetId: 'tuidaohu', difficulty: 'novice', hintEnabled: true, gamesUntilBackupHint: 20 });
      const s = await repo.getSettings();
      expect(s?.rulesetId).toBe('tuidaohu');
      expect(s?.difficulty).toBe('novice');
    });

    it('对局创建/结束/列表（按开始时间倒序）', async () => {
      const repo = await make();
      await repo.createGame({ id: 'g1', rulesetId: 'tuidaohu', startedAt: 100, finishedAt: null, outcome: 'ongoing' });
      await repo.createGame({ id: 'g2', rulesetId: 'gangshi', startedAt: 200, finishedAt: null, outcome: 'ongoing' });
      await repo.finishGame('g1', 'win');
      const list = await repo.listGames();
      expect(list.map((g) => g.id)).toEqual(['g2', 'g1']);
      expect(list.find((g) => g.id === 'g1')?.outcome).toBe('win');
      expect(list.find((g) => g.id === 'g1')?.finishedAt).not.toBeNull();
      const limited = await repo.listGames(1);
      expect(limited.map((g) => g.id)).toEqual(['g2']);
    });

    it('快照追加有序、重复 seq 拒绝', async () => {
      const repo = await make();
      await repo.createGame({ id: 'g1', rulesetId: 'tuidaohu', startedAt: 1, finishedAt: null, outcome: 'ongoing' });
      await repo.appendSnapshot('g1', 2, '{"step":2}');
      await repo.appendSnapshot('g1', 0, '{"step":0}');
      await repo.appendSnapshot('g1', 1, '{"step":1}');
      const snaps = await repo.loadSnapshots('g1');
      expect(snaps.map((s) => s.seq)).toEqual([0, 1, 2]);
      await expect(repo.appendSnapshot('g1', 1, '{"dup":1}')).rejects.toThrow();
    });

    it('练习进度与错题本', async () => {
      const repo = await make();
      expect(await repo.getQuizProgress('ch1')).toBeNull();
      await repo.saveQuizProgress({ chapterId: 'ch1', doneQuestionIds: ['q1'], correctIds: [] });
      await repo.saveQuizProgress({ chapterId: 'ch1', doneQuestionIds: ['q1', 'q2'], correctIds: ['q2'] });
      expect((await repo.getQuizProgress('ch1'))?.doneQuestionIds).toEqual(['q1', 'q2']);
      await repo.addMistake({ id: 'm1', questionId: 'q1', chapterId: 'ch1', wrongAnswer: 'p1', at: 5 });
      await repo.addMistake({ id: 'm2', questionId: 'q3', chapterId: 'ch1', wrongAnswer: 'p2', at: 3 });
      expect((await repo.listMistakes()).map((m) => m.id)).toEqual(['m2', 'm1']);
      await repo.removeMistake('m2');
      expect((await repo.listMistakes()).map((m) => m.id)).toEqual(['m1']);
    });

    it('导出 → 清空 → 导入 replace 数据一致；坏 JSON 拒绝', async () => {
      const repo = await make();
      await repo.saveSettings({ rulesetId: 'gangshi', difficulty: 'expert', hintEnabled: false, gamesUntilBackupHint: 20 });
      await repo.createGame({ id: 'g1', rulesetId: 'tuidaohu', startedAt: 1, finishedAt: null, outcome: 'ongoing' });
      await repo.appendSnapshot('g1', 0, '{"step":0}');
      await repo.addMistake({ id: 'm1', questionId: 'q1', chapterId: 'ch1', wrongAnswer: 'p1', at: 5 });
      const dump = await repo.exportAll();

      const fresh = await make();
      await expect(fresh.importAll('{bad json', 'replace')).rejects.toThrow();
      await fresh.importAll(dump, 'replace');
      expect(await fresh.getSettings()).toEqual(await repo.getSettings());
      expect((await fresh.listGames()).map((g) => g.id)).toEqual(['g1']);
      expect((await fresh.loadSnapshots('g1')).map((s) => s.seq)).toEqual([0]);
      expect((await fresh.listMistakes()).map((m) => m.id)).toEqual(['m1']);
    });

    it('导入 merge 不覆盖重复数据', async () => {
      const repo = await make();
      await repo.createGame({ id: 'g1', rulesetId: 'tuidaohu', startedAt: 1, finishedAt: null, outcome: 'ongoing' });
      const dump = await repo.exportAll();
      const target = await make();
      await target.createGame({ id: 'g0', rulesetId: 'gangshi', startedAt: 0, finishedAt: null, outcome: 'ongoing' });
      await target.importAll(dump, 'merge');
      expect((await target.listGames()).map((g) => g.id).sort()).toEqual(['g0', 'g1']);
    });
  });
}
