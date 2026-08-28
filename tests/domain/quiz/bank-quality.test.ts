// 题库质量守卫：用引擎的效率评估机械验证 choose-discard 题。
// 语义：hand 为 13 张；选项可能是「刚摸进的牌」（不在 13 张内），验证时把选项补进
// 手牌再评估打出后的评分。
//  - efficiency 章：best 必须评分最高；acceptable 与 best 同向听且分差 < 2；其余选项不得优于 best；
//  - safety 章：出牌常以安全换效率（甚至掉向听），机械效率判定不适用，豁免（人工核对）。
// fan-reading 题同样人工核对。
import { describe, it, expect } from 'vitest';
import bankJson from '../../../src/domain/quiz/bank.json';
import { evalDiscards, scoreOf } from '../../../src/domain/ai/efficiency';
import { getRuleset } from '../../../src/domain/rulesets';
import { parseHandShorthand, tileIdToIndex, type TileId } from '../../../src/domain/tiles';
import type { QuizQuestion } from '../../../src/domain/quiz/types';

const bank = bankJson as unknown as QuizQuestion[];
const rs = getRuleset('tuidaohu');
const SUITS = ['m', 'p', 's', 'z'] as const;

function viewWithOption(hand: string, option: TileId): Parameters<typeof evalDiscards>[0] {
  const counts = parseHandShorthand(hand);
  counts[tileIdToIndex(option)]++;
  const ids: TileId[] = [];
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) ids.push(`${SUITS[Math.floor(i / 9)]}${(i % 9) + 1}`);
  });
  return {
    seat: 0,
    turn: 0,
    phase: 'action',
    hand: ids,
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    seenCounts: counts.slice(),
    wallCount: 40,
    dealer: 0,
    drawnTile: option,
    rulesetId: 'tuidaohu',
  };
}

describe('题库效率答案机械验证', () => {
  for (const q of bank.filter((x) => x.type === 'choose-discard' && x.chapter === 'efficiency')) {
    it(`${q.id}: best=${q.best} 应为选项中评分最高`, () => {
      const scoreOfTile = (t: TileId): { s: number; score: number } => {
        const evals = evalDiscards(viewWithOption(q.hand, t), rs);
        const e = evals.find((x) => x.tile === t);
        if (!e) throw new Error(`评估失败：${t}`);
        return { s: e.shantenAfter, score: scoreOf(e, 4) };
      };
      const best = scoreOfTile(q.best);
      for (const a of q.acceptable ?? []) {
        const s = scoreOfTile(a);
        expect(s.s, `${q.id} acceptable ${a} 向听应与 best 相同`).toBe(best.s);
        expect(Math.abs(s.score - best.score), `${q.id} acceptable ${a} 分差应小于 2`).toBeLessThan(2);
      }
      for (const o of q.options.filter((o) => o !== q.best && !(q.acceptable ?? []).includes(o))) {
        const s = scoreOfTile(o);
        expect(
          s.score <= best.score,
          `${q.id} 选项 ${o} (score=${s.score}) 不应优于 best (score=${best.score})`,
        ).toBe(true);
      }
    });
  }
});
