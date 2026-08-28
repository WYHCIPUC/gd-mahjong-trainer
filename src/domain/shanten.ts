// 向听数算法（纯函数）。
// 标准型公式：s = need*2 - 2*面子m - 搭子p - (有雀头?1:0)，约束 面子+搭子 ≤ need，
// need = 4 - 已碰杠组数；仅统计暗牌。13 张暗牌时最小值为 0（听牌），
// 胡形（-1）判定由 agari 模块在 14 张（含胡牌张）上完成。

export function shantenStandard(hand: number[], meldedSets = 0): number {
  const need = 4 - meldedSets;
  if (need < 0) throw new Error('碰杠组数超过 4');
  // 防御性校验（设计文档·错误处理）：非法向量显式抛错，绝不静默给出错误答案
  for (const c of hand) {
    if (!Number.isInteger(c) || c < 0 || c > 4) {
      throw new Error(`手牌向量非法（应为 0-4 的整数）: ${JSON.stringify(hand)} melded=${meldedSets}`);
    }
  }
  const counts = hand.slice();
  let best = need * 2 + 1; // 根节点 leaf 会立即落为真实上界
  const leaf = (m: number, p: number, pair: boolean) => {
    const s = need * 2 - 2 * m - p - (pair ? 1 : 0);
    if (s < best) best = s;
  };

  // 递归深度有界：每层要么 i 前进，要么消耗至少一张牌
  const scan = (i: number, m: number, p: number, pair: boolean): void => {
    leaf(m, p, pair);
    while (i < 34 && counts[i] === 0) i++;
    if (i >= 34) {
      leaf(m, p, pair);
      return;
    }
    const blockable = m + p < need;
    if (counts[i] >= 3 && blockable) {
      // 刻子
      counts[i] -= 3;
      scan(i, m + 1, p, pair);
      counts[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0 && blockable) {
      // 顺子（仅数牌）
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      scan(i, m + 1, p, pair);
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
    if (!pair && counts[i] >= 2) {
      // 雀头（全局至多一个）
      counts[i] -= 2;
      scan(i, m, p, true);
      counts[i] += 2;
    }
    if (i < 27 && i % 9 <= 7 && counts[i + 1] > 0 && blockable) {
      // 两面/邻位搭子
      counts[i]--; counts[i + 1]--;
      scan(i, m, p + 1, pair);
      counts[i]++; counts[i + 1]++;
    }
    if (i < 27 && i % 9 <= 6 && counts[i + 2] > 0 && blockable) {
      // 坎张搭子
      counts[i]--; counts[i + 2]--;
      scan(i, m, p + 1, pair);
      counts[i]++; counts[i + 2]++;
    }
    if (counts[i] >= 2 && blockable) {
      // 对子搭子
      counts[i] -= 2;
      scan(i, m, p + 1, pair);
      counts[i] += 2;
    }
    counts[i]--; // 视作孤张（含第 4 张等多余张）
    scan(i, m, p, pair);
    counts[i]++;
    scan(i + 1, m, p, pair); // 该种全部弃置
  };

  scan(0, 0, 0, false);
  return best;
}

// 七对：s = 6 - 对子种数 + 四同张惩罚（四同张只算一对，浪费两张）
export function shantenChiitoi(hand: number[]): number {
  let pairs = 0;
  let quads = 0;
  for (const c of hand) {
    if (c >= 2) pairs++;
    if (c === 4) quads++;
  }
  return 6 - pairs + quads;
}

const KOKUSHI_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

// 十三幺：s = 13 - 持有幺九字种数 - (任一种成对?1:0)
export function shantenKokushi(hand: number[]): number {
  let kinds = 0;
  let hasPair = 0;
  for (const t of KOKUSHI_KINDS) {
    if (hand[t] > 0) {
      kinds++;
      if (hand[t] >= 2) hasPair = 1;
    }
  }
  return 13 - kinds - hasPair;
}
