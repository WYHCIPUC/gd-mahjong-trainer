import { describe, it, expect } from 'vitest';
import { decide, scoreCandidate } from '../../../src/domain/ai/decider';
import { fanExpectation, type DiscardEval } from '../../../src/domain/ai/efficiency';
import { getRuleset } from '../../../src/domain/rulesets';
import type { PlayerView } from '../../../src/domain/game-types';
import { toCounts, tileIdToIndex, type TileId } from '../../../src/domain/tiles';

const viewOf = (
  hand: TileId[],
  phase: PlayerView['phase'],
  opts: Partial<PlayerView> = {},
): PlayerView => {
  const seen = toCounts(hand);
  for (const d of opts.discards ?? [[], [], [], []]) {
    for (const t of d) seen[tileIdToIndex(t)]++;
  }
  return {
    seat: 0,
    turn: 1,
    phase,
    hand,
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    seenCounts: seen,
    wallCount: 40,
    dealer: 0,
    rulesetId: 'tuidaohu',
    ...opts,
  };
};

describe('scoreCandidate（难度加权公式）', () => {
  const e: DiscardEval = { tile: 'p5', shantenAfter: 0, ukeireTiles: 8 };
  it('novice 不计危险度', () => {
    expect(scoreCandidate(e, 90, 'novice', 4, 0)).toBe(408);
  });
  it('intermediate 扣 0.8×危险度', () => {
    expect(scoreCandidate(e, 90, 'intermediate', 4, 0)).toBeCloseTo(408 - 72);
  });
  it('expert 叠加番数倾向加成', () => {
    expect(scoreCandidate(e, 0, 'expert', 4, 1)).toBe(408 + 4);
  });
});

describe('decide·行动阶段', () => {
  it('听牌手打出合法张且理由含效率', () => {
    const hand: TileId[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p2', 'p3', 'z5', 'z5', 'z1'];
    const view = viewOf(hand, 'action');
    for (const diff of ['novice', 'intermediate', 'expert'] as const) {
      const d = decide(view, diff, getRuleset('tuidaohu'));
      expect(d.action.type).toBe('discard');
      expect(d.reasons.length).toBeGreaterThan(0);
      expect(d.reasons[0].kind).toBe('efficiency');
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('已胡（自摸）必胡', () => {
    const hand: TileId[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 'z5', 'z5'];
    const view = viewOf(hand, 'action');
    const d = decide(view, 'novice', getRuleset('tuidaohu'));
    expect(d.action.type).toBe('win');
    expect(d.confidence).toBe(1);
  });
});

describe('decide·宣称阶段', () => {
  it('能胡必胡', () => {
    const hand: TileId[] = ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'p1', 'p1', 'p1', 's2', 's2', 's2', 'z5'];
    const view = viewOf(hand, 'claims', { lastDiscard: { tile: 'z5', from: 1 } });
    const d = decide(view, 'intermediate', getRuleset('tuidaohu'));
    expect(d.action.type).toBe('win');
    expect(d.confidence).toBe(1);
  });

  it('无胡无利则跳过', () => {
    const hand: TileId[] = ['z5', 'z5', 'm1', 'm5', 'm9', 'p1', 'p5', 'p9', 's1', 's5', 's9', 'z1', 'z2'];
    const view = viewOf(hand, 'claims', { lastDiscard: { tile: 'z1', from: 1 } });
    const d = decide(view, 'intermediate', getRuleset('tuidaohu'));
    expect(['peng', 'pass']).toContain(d.action.type);
  });
});

describe('fanExpectation', () => {
  it('清一色方向的牌型期望更高', () => {
    const flush = viewOf(['m1', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm9', 'm1', 'm2', 'm3'], 'action');
    const mixed = viewOf(['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z1', 'z2', 'z3', 'm5', 'm6'], 'action');
    expect(fanExpectation(flush)).toBeGreaterThan(fanExpectation(mixed));
  });
});
