// 随机练习：随机局面 → AI 决策器给出标准答案与理由 → 按容差判分（与静态题共用规则）。
import { decide } from '../ai/decider';
import { evalDiscards } from '../ai/efficiency';
import type { Difficulty } from '../ai/types';
import { getRuleset } from '../rulesets';
import { fromCounts, indexToTileId, tileIdToIndex, type TileId } from '../tiles';
import type { QuizQuestion } from './types';

export function randomHand(rng: () => number): number[] {
  const counts = new Array<number>(34).fill(0);
  let n = 0;
  while (n < 13) {
    const i = Math.floor(rng() * 34);
    if (counts[i] < 4) {
      counts[i]++;
      n++;
    }
  }
  return counts;
}

/** 把 TileId 数组转成题库简写（花色后置，如 "123m456p"） */
function toShorthand(ids: TileId[]): string {
  let out = '';
  let digits = '';
  let suit = '';
  const flush = (): void => {
    out += digits + suit;
    digits = '';
  };
  for (const id of ids) {
    const s = id[0];
    if (s !== suit) {
      flush();
      suit = s;
    }
    digits += id.slice(1);
  }
  flush();
  return out;
}


/** 出一道「打哪张」随机练习题：标准答案与可接受答案均来自同难度 AI 的效率评估 */
export function generateDiscardQuiz(seed: number, difficulty: Difficulty = 'expert'): QuizQuestion | null {
  const rng = (() => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const ruleset = getRuleset('tuidaohu');
  const hand = randomHand(rng);
  const handIds = fromCounts(hand);
  const seen = hand.slice();
  const view = {
    seat: 0,
    turn: 0,
    phase: 'action' as const,
    hand: handIds,
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    seenCounts: seen,
    wallCount: 40,
    dealer: 0,
    drawnTile: handIds[handIds.length - 1],
    rulesetId: 'tuidaohu',
  };
  const d = decide(view, difficulty, ruleset);
  if (d.action.type !== 'discard') return null;
  const bestTile = d.action.tile;
  const evals = evalDiscards(view, ruleset);
  const bestEval = evals.find((e) => e.tile === bestTile);
  if (!bestEval) return null;
  // 容差：与最优同向听且进张差 < 2 的候选都算「两者皆可」
  const acceptable = evals
    .filter(
      (e) =>
        e.tile !== bestTile &&
        e.shantenAfter === bestEval.shantenAfter &&
        bestEval.ukeireTiles - e.ukeireTiles < 2 &&
        bestEval.ukeireTiles - e.ukeireTiles >= 0,
    )
    .map((e) => e.tile)
    .slice(0, 2);
  // 选项：最优 + 可接受 + 两个明显更差的
  const worse = evals
    .filter((e) => e.shantenAfter > bestEval.shantenAfter || !acceptable.includes(e.tile))
    .filter((e) => e.tile !== bestTile && !acceptable.includes(e.tile))
    .sort((a, b) => b.shantenAfter - a.shantenAfter || a.ukeireTiles - b.ukeireTiles)
    .map((e) => e.tile);
  const options = [bestTile, ...acceptable, ...worse.slice(0, Math.max(0, 4 - 1 - acceptable.length))];
  const aiReason = d.reasons.map((r) => r.text).join('；');
  return {
    id: `gen-${seed}`,
    chapter: 'efficiency',
    type: 'choose-discard',
    hand: toShorthand(handIds),
    options,
    best: bestTile,
    acceptable,
    explanation: `AI（${difficulty}）会打 ${bestTile}：${aiReason}。打 ${bestTile} 后向听 ${bestEval.shantenAfter}，有效进张 ${bestEval.ukeireTiles} 张。`,
  };
}

/** options 与 best 的合法性校验（题库 schema 测试与生成器共用） */
export function validateQuizQuestion(q: QuizQuestion): string | null {
  const handCounts = q.hand.match(/[mpsz]/) ? handIdsOf(q) : null;
  if (!handCounts) return 'hand 缺少花色后缀';
  for (const o of q.options) {
    try {
      tileIdToIndex(o);
    } catch {
      return `非法选项 ${o}`;
    }
  }
  if (!q.options.includes(q.best)) return 'best 不在 options 中';
  for (const a of q.acceptable ?? []) if (!q.options.includes(a)) return `acceptable ${a} 不在 options 中`;
  if (new Set(q.options).size !== q.options.length) return 'options 有重复';
  return null;
}

function handIdsOf(q: QuizQuestion): TileId[] | null {
  const ids: TileId[] = [];
  let digits = '';
  for (const ch of q.hand) {
    if (ch >= '1' && ch <= '9') digits += ch;
    else if (['m', 'p', 's', 'z'].includes(ch)) {
      for (const d of digits) ids.push(indexToTileId(tileIdToIndex(`${ch}${d}`)));
      digits = '';
    } else return null;
  }
  return digits ? null : ids;
}
