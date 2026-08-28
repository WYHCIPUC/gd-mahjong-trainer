// 胡牌牌型分解（纯函数）。输入为 14 张暗牌计数向量（含胡牌张）。
// decomposeStandard 返回全部标准形分解（雀头 + 面子组）；七对/十三幺为独立形状判定。
import { indexToTileId, tileIdToIndex, type TileId } from './tiles';

export interface MeldRef {
  type: 'peng' | 'chi' | 'mingGang' | 'anGang' | 'buGang';
  tiles: TileId[];
}

export interface Decomposition {
  pair: TileId;
  sets: TileId[][];
}

/** 标准形全分解：雀头 + n 组面子（面子为刻子或顺子，TileId 三个） */
export function decomposeStandard(counts14: number[]): Decomposition[] {
  const counts = counts14.slice();
  const results: Decomposition[] = [];
  const seen = new Set<string>();

  const record = (pair: TileId, sets: TileId[][]): void => {
    const sig = JSON.stringify([pair, sets.map((s) => [...s].sort().join('')).sort()]);
    if (seen.has(sig)) return;
    seen.add(sig);
    results.push({ pair, sets });
  };

  const rec = (i: number, sets: TileId[][], pair: TileId | null): void => {
    while (i < 34 && counts[i] === 0) i++;
    if (i >= 34) {
      if (pair !== null) record(pair, sets);
      return;
    }
    if (counts[i] >= 3) {
      const t = [indexToTileId(i), indexToTileId(i), indexToTileId(i)];
      counts[i] -= 3;
      rec(i, [...sets, t], pair);
      counts[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      const t = [indexToTileId(i), indexToTileId(i + 1), indexToTileId(i + 2)];
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      rec(i, [...sets, t], pair);
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
    // 当前牌无法归组（顺子/刻子都取不出）→ 本分支失败，靠回溯枚举其它拆法
  };

  for (let p = 0; p < 34; p++) {
    if (counts[p] >= 2) {
      counts[p] -= 2;
      rec(0, [], indexToTileId(p));
      counts[p] += 2;
    }
  }
  return results;
}

/** 分解合法性自检（测试与调试用）：牌数守恒、每组面子合法 */
export function validateDecomposition(d: Decomposition, totalTiles: number): boolean {
  const used = tileIdToIndex(d.pair);
  let n = 2;
  for (const s of d.sets) {
    if (s.length !== 3) return false;
    const idx = s.map(tileIdToIndex);
    const triplet = idx[0] === idx[1] && idx[1] === idx[2];
    const run = idx[0] < 27 && idx[1] === idx[0] + 1 && idx[2] === idx[0] + 2;
    if (!triplet && !run) return false;
    n += 3;
    void used;
  }
  return n === totalTiles;
}

/** 七对形：14 张、恰 7 种、每种 2 张 */
export function isChiitoiShape(counts14: number[]): boolean {
  let kinds = 0;
  for (const c of counts14) {
    if (c % 2 !== 0) return false;
    if (c > 0) kinds++;
  }
  return kinds === 7;
}

const KOKUSHI_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

/** 十三幺形：幺九字 13 种齐 + 某一种成对，共 14 张 */
export function isKokushiShape(counts14: number[]): boolean {
  let total = 0;
  let pairs = 0;
  for (const k of KOKUSHI_KINDS) {
    const c = counts14[k];
    if (c > 0) total += c;
    if (c === 2) pairs++;
    if (c > 2) return false;
  }
  for (let i = 0; i < 34; i++) {
    if (!KOKUSHI_KINDS.includes(i) && counts14[i] > 0) return false;
  }
  return total === 14 && pairs === 1;
}
