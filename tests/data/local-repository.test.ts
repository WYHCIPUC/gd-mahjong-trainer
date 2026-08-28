import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { runRepositoryContractTests } from './contract';
import { createLocalRepository, KEEP_GAMES } from '../../src/data/local-repository';

let dbSeq = 0;
runRepositoryContractTests('LocalRepository(IndexedDB)', async () => {
  // 每个用例独立数据库，保证“新实例”语义与内存实现一致
  return createLocalRepository(`test-db-${++dbSeq}`);
});

describe('环形缓冲', () => {
  it('已完成对局超过上限时删除最旧，进行中对局不删', async () => {
    const repo = await createLocalRepository(`ring-db-${++dbSeq}`);
    for (let i = 0; i < KEEP_GAMES + 5; i++) {
      await repo.createGame({ id: `g${i}`, rulesetId: 'tuidaohu', startedAt: i, finishedAt: null, outcome: 'ongoing' });
      await repo.finishGame(`g${i}`, 'draw');
      await repo.appendSnapshot(`g${i}`, 0, '{"step":0}');
    }
    await repo.createGame({
      id: 'ongoing',
      rulesetId: 'tuidaohu',
      startedAt: 9999,
      finishedAt: null,
      outcome: 'ongoing',
    });
    const games = await repo.listGames();
    expect(games.length).toBe(KEEP_GAMES + 1); // 200 局已完成 + 1 局进行中
    expect(games.find((g) => g.id === 'g4')).toBeUndefined(); // 最旧 5 局被删
    expect(games.find((g) => g.id === 'g5')).toBeDefined();
    expect(games.find((g) => g.id === 'ongoing')).toBeDefined(); // 进行中不删（崩溃恢复优先）
    const snaps = await repo.loadSnapshots('g4');
    expect(snaps.length).toBe(0); // 快照随对局一起删除
  });
});
