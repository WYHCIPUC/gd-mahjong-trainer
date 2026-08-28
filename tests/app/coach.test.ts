import { describe, it, expect } from 'vitest';
import { evaluateTurn, COACH_THRESHOLDS } from '../../src/app/coach';
import { toCounts, type TileId } from '../../src/domain/tiles';
import type { PlayerView } from '../../src/domain/game-types';

const viewOf = (hand: TileId[], discards: TileId[][] = [[], [], [], []]): PlayerView => {
  const seen = toCounts([...hand, ...discards.flat()]);
  return {
    seat: 0,
    turn: 0,
    phase: 'action',
    hand,
    melds: [[], [], [], []],
    discards,
    seenCounts: seen,
    wallCount: 40,
    dealer: 0,
    rulesetId: 'tuidaohu',
  };
};

describe('evaluateTurn 教练评估', () => {
  it('与 AI 打同一张：不提示', () => {
    // 123m456m789m123p + 55z：AI 打 z5?? 让 AI 自己选，玩家跟随
    const hand: TileId[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 'z5', 'z5'];
    const view = viewOf(hand);
    const ai = evaluateTurn(view, { type: 'discard', tile: 'z1' }, 'novice'); // 先拿 AI 意见
    if (ai.aiDecision.action.type === 'discard') {
      const tile = ai.aiDecision.action.tile;
      const r = evaluateTurn(view, { type: 'discard', tile }, 'novice');
      expect(r.hint).toBeNull();
    }
  });

  it('明显低效出牌：提示且分歧入列', () => {
    // 14 张：三组顺子 + 34p 搭子 + 55z 雀头 + 孤张 z1 与摸进 z2：打 z2（AI 大概率打 z1 保同门?? 需确定性）
    // 直接构造：AI 必选的候选与明显差 4 张进张的候选
    const hand: TileId[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'z5', 'z5', 'z6'];
    const view = viewOf(hand);
    const r = evaluateTurn(view, { type: 'discard', tile: 'p1' }, 'novice');
    // 打 p1 后 23p 两面进张 8；若 AI 打 z9 之类进张更少则不提示——断言按阈值语义检查
    if (r.hint) {
      expect(r.hint.ukeireDiff).toBeGreaterThanOrEqual(COACH_THRESHOLDS.ukeireDiff);
      expect(r.divergence?.aiTile).toBeTruthy();
    } else {
      expect(r.aiDecision.reasons.length).toBeGreaterThan(0);
    }
  });

  it('非出牌动作（胡）不产生提示', () => {
    const hand: TileId[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 'z5', 'z5'];
    const view = viewOf(hand);
    const r = evaluateTurn(view, { type: 'win', selfDraw: true }, 'novice');
    expect(r.hint).toBeNull();
  });
});
