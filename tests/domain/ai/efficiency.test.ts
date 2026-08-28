import { describe, it, expect } from 'vitest';
import { evalDiscards, scoreOf } from '../../../src/domain/ai/efficiency';
import { getRuleset } from '../../../src/domain/rulesets';
import type { PlayerView } from '../../../src/domain/game-types';
import { parseHandShorthand, tileIdToIndex, toCounts, type TileId } from '../../../src/domain/tiles';

const SUITS = ['m', 'p', 's', 'z'] as const;

const viewOf = (hand14: string, rulesetId = 'tuidaohu', extraSeen: TileId[] = []): PlayerView => {
  const counts = parseHandShorthand(hand14);
  const ids: TileId[] = [];
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) ids.push(`${SUITS[Math.floor(i / 9)]}${(i % 9) + 1}`);
  });
  const seen = counts.slice();
  for (const t of extraSeen) seen[tileIdToIndex(t)]++;
  return {
    seat: 0,
    turn: 0,
    phase: 'action',
    hand: ids,
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    seenCounts: seen,
    wallCount: 40,
    dealer: 0,
    drawnTile: ids[ids.length - 1],
    rulesetId,
  };
};

describe('evalDiscards', () => {
  it('听牌局面：留两面连形进张最多（8m9m 兼容 789m/888m/999m）', () => {
    // 14 张：123m456m789m 123p 55p；打 1m 留 234m+567m+89m → 听 7m/8m/9m 共 12 张
    const view = viewOf('123m456m789m123p55p');
    const evals = evalDiscards(view, getRuleset('tuidaohu'));
    const m1 = evals.find((e) => e.tile === 'm1');
    expect(m1?.shantenAfter).toBe(0);
    expect(m1?.ukeireTiles).toBe(10); // 1m×4 + 4m×3 + 7m×3（4m/7m 手中已见各扣 1）
    const best = evals.reduce((a, b) => (scoreOf(b, 4) > scoreOf(a, 4) ? b : a));
    expect(best.tile).toBe('m1');
  });

  it('同为听牌时进张差异正确', () => {
    const view = viewOf('123m456m789m123p55p');
    const evals = evalDiscards(view, getRuleset('tuidaohu'));
    const p1 = evals.find((e) => e.tile === 'p1');
    const p3 = evals.find((e) => e.tile === 'p3');
    expect(p1?.ukeireTiles).toBe(8); // 打 1p 留 23p 两面听 1p/4p
    expect(p3?.ukeireTiles).toBe(4); // 打 3p 留 12p 两面听 3p 仅 4 张
  });

  it('副露减少 need，评分基准随之变化', () => {
    const view = viewOf('123m456m789m12p55p');
    view.melds[0] = [{ type: 'peng', tiles: ['z5', 'z5', 'z5'] }];
    view.hand = view.hand.slice(0, 11); // 碰后 10 张暗牌 + 刚摸 1
    const evals = evalDiscards(view, getRuleset('tuidaohu'));
    expect(evals.length).toBeGreaterThan(0);
    expect(scoreOf(evals[0], 4 - 1)).toBeGreaterThan(0);
  });

  it('已见牌计入进张剩余（seen 含对手弃牌）', () => {
    // 打 1p 后两面 23p，但 1p 与 4p 各被别人打掉一张 → 进张 6
    const view = viewOf('123m456m789m123p55p', 'tuidaohu', ['p1', 'p4']);
    const evals = evalDiscards(view, getRuleset('tuidaohu'));
    const p1 = evals.find((e) => e.tile === 'p1');
    expect(p1?.ukeireTiles).toBe(6);
  });
});

describe('toCounts 守恒', () => {
  it('视图手牌向量与 TileId 一致', () => {
    const view = viewOf('123m456m789m123p5p');
    expect(toCounts(view.hand)).toEqual(parseHandShorthand('123m456m789m123p5p'));
  });
});
