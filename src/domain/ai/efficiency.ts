// 进攻效率评估：对每个候选打牌给出「打出后向听 + 有效进张」。
// 性能预算（AI 单决策 < 50ms）：只为最优向听档计算进张；向听结果按局面缓存。
import { shantenOf } from '../engine';
import type { Ruleset } from '../rulesets/types';
import type { PlayerView } from '../game-types';
import { indexToTileId, tileIdToIndex, toCounts, type TileId } from '../tiles';

export interface DiscardEval {
  tile: TileId;
  shantenAfter: number;
  ukeireTiles: number; // 使向听下降的摸牌总剩余张数
}

/** 打出该张的进攻评分：向听进度为主，同向听比进张。need = 4 - 已碰杠组数 */
export function scoreOf(e: DiscardEval, need: number): number {
  return 100 * (need - Math.max(e.shantenAfter, 0)) + e.ukeireTiles;
}

export function evalDiscards(view: PlayerView, ruleset: Ruleset): DiscardEval[] {
  const hand = toCounts(view.hand);
  const meldedSets = view.melds[view.seat].length;
  const seen = view.seenCounts.slice();
  const cache = new Map<string, number>();
  const sh = (counts: number[]): number => {
    const key = counts.join(',');
    let v = cache.get(key);
    if (v === undefined) {
      v = shantenOf(counts, meldedSets, ruleset);
      cache.set(key, v);
    }
    return v;
  };

  const results: DiscardEval[] = [];
  for (let t = 0; t < 34; t++) {
    if (hand[t] === 0) continue;
    hand[t]--;
    results.push({ tile: indexToTileId(t), shantenAfter: sh(hand), ukeireTiles: 0 });
    hand[t]++;
  }
  const best = Math.min(...results.map((r) => r.shantenAfter));
  for (const r of results) {
    if (r.shantenAfter !== best) continue;
    const t = tileIdToIndex(r.tile);
    hand[t]--;
    seen[t]--; // 已打出，不再计入已见
    let ukeire = 0;
    for (let d = 0; d < 34; d++) {
      const avail = 4 - seen[d];
      if (avail <= 0) continue;
      hand[d]++;
      if (sh(hand) < best) ukeire += avail;
      hand[d]--;
    }
    seen[t]++;
    hand[t]++;
    r.ukeireTiles = ukeire;
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
