// 进攻效率评估：对每个候选打牌给出「打出后向听 + 有效进张」。
// 性能预算（AI 单决策 < 50ms）三项措施：
//   1. 向听结果模块级缓存（对局中局面大量重复，跨决策/跨回合复用）；
//   2. 打出结果相同的候选（如拆对子任意一张）按等价类去重，进张只算一次；
//   3. 只为最优向听档的前 6 个等价类计算进张（ heuristic 损失可忽略，见设计文档）。
import { shantenOf } from '../engine';
import type { Ruleset } from '../rulesets/types';
import type { PlayerView } from '../game-types';
import { indexToTileId, tileIdToIndex, toCounts, type TileId } from '../tiles';

export interface DiscardEval {
  tile: TileId;
  shantenAfter: number;
  ukeireTiles: number; // 使向听下降的摸牌总剩余张数
}

const MAX_UKEIRE_CLASSES = 6;
const SHANTEN_CACHE_LIMIT = 300_000;
const shantenCache = new Map<string, number>();

function cachedShanten(counts: number[], meldedSets: number, ruleset: Ruleset): number {
  const key = `${ruleset.id}|${meldedSets}|${counts.join(',')}`;
  let v = shantenCache.get(key);
  if (v === undefined) {
    v = shantenOf(counts, meldedSets, ruleset);
    if (shantenCache.size >= SHANTEN_CACHE_LIMIT) shantenCache.clear();
    shantenCache.set(key, v);
  }
  return v;
}

/** 打出该张的进攻评分：向听进度为主，同向听比进张。need = 4 - 已碰杠组数 */
export function scoreOf(e: DiscardEval, need: number): number {
  return 100 * (need - Math.max(e.shantenAfter, 0)) + e.ukeireTiles;
}

export function evalDiscards(view: PlayerView, ruleset: Ruleset): DiscardEval[] {
  const hand = toCounts(view.hand);
  const meldedSets = view.melds[view.seat].length;
  const seen = view.seenCounts.slice();

  const results: DiscardEval[] = [];
  for (let t = 0; t < 34; t++) {
    if (hand[t] === 0) continue;
    hand[t]--;
    results.push({ tile: indexToTileId(t), shantenAfter: cachedShanten(hand, meldedSets, ruleset), ukeireTiles: 0 });
    hand[t]++;
  }
  const best = Math.min(...results.map((r) => r.shantenAfter));

  // 等价类去重：打出后暗牌向量相同的候选共用一次进张计算
  const classes = new Map<string, DiscardEval[]>();
  for (const r of results) {
    if (r.shantenAfter !== best) continue;
    const t = tileIdToIndex(r.tile);
    hand[t]--;
    const sig = hand.join(',');
    hand[t]++;
    const group = classes.get(sig);
    if (group) group.push(r);
    else classes.set(sig, [r]);
  }

  let computed = 0;
  for (const group of classes.values()) {
    if (computed >= MAX_UKEIRE_CLASSES) break; // 超出部分 ukeire 记 0（仍保持向听排序正确）
    computed++;
    const rep = group[0];
    const t = tileIdToIndex(rep.tile);
    hand[t]--;
    seen[t]--; // 已打出，不再计入已见
    let ukeire = 0;
    for (let d = 0; d < 34; d++) {
      const avail = 4 - seen[d];
      if (avail <= 0) continue;
      hand[d]++;
      if (cachedShanten(hand, meldedSets, ruleset) < best) ukeire += avail;
      hand[d]--;
    }
    seen[t]++;
    hand[t]++;
    for (const r of group) r.ukeireTiles = ukeire;
  }
  return results;
}

/** 粗略番数期望（可解释的单调估计，不追求精确）：花色集中度（清/混一色方向）+ 对子数（碰碰方向） */
export function fanExpectation(view: PlayerView): number {
  const hand = toCounts(view.hand);
  const melded = view.melds[view.seat];
  const suitTiles = [0, 0, 0, 0]; // m p s z
  for (let t = 0; t < 34; t++) suitTiles[Math.floor(t / 9)] += hand[t];
  for (const m of melded) suitTiles[Math.floor(tileIdToIndex(m.tiles[0]) / 9)] += 3;
  const numberTotal = suitTiles[0] + suitTiles[1] + suitTiles[2];
  let fan = 0;
  if (numberTotal > 0) {
    const ratio = Math.max(suitTiles[0], suitTiles[1], suitTiles[2]) / numberTotal;
    if (melded.length === 0 && ratio >= 0.9) fan += 6; // 清一色方向
    else if (ratio >= 0.7) fan += 3;
    else if (ratio >= 0.55) fan += 1;
  }
  let pairs = 0;
  for (let t = 0; t < 34; t++) if (hand[t] >= 2) pairs++;
  if (pairs >= 3) fan += 2; // 碰碰方向
  return fan;
}
