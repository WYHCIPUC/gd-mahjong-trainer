// 计算服务：规则引擎的薄封装（应用层）。
// 输入摆牌 → 听牌枚举（扣已见）→ 每张听牌番数预估 → 起胡可行性提示（设计决策 #11）。
import { canWin, listWaits, type Wait } from '../domain/engine';
import { getRuleset } from '../domain/rulesets';
import type { FanResult } from '../domain/score';
import type { MeldRef } from '../domain/agari';
import { tileIdToIndex, toCounts, type TileId } from '../domain/tiles';
import { MahjongError } from './game-controller';

export interface CalcInput {
  /** 暗牌（不含副露），须为 (4 - 副露组数)×3 + 1 张 */
  hand: TileId[];
  melded: MeldRef[];
  /** 已见牌（不含自己暗牌与副露）：对手弃牌等，用于剩余张数 */
  seen: TileId[];
  rulesetId: string;
}

export interface CalcOutput {
  waits: Wait[];
  fans: { tile: TileId; fan: FanResult | 'cannotWin' }[];
  /** 起胡提示：部分听牌番数不足时的说明 */
  startingFanHint: string | null;
}

const meldTileCount = (m: MeldRef): number => (m.type === 'peng' || m.type === 'chi' ? 3 : 4);

export function calculate(input: CalcInput): CalcOutput {
  const ruleset = getRuleset(input.rulesetId);
  const handCounts = toCounts(input.hand); // 非法牌（如同牌 5 张）在此显式抛错——UI 即时校验之外的双保险
  const meldedSets = input.melded.length;
  const expected = (4 - meldedSets) * 3 + 1;
  if (input.hand.length !== expected) {
    throw new MahjongError('BAD_HAND_COUNT', `暗牌应为 ${expected} 张（当前 ${input.hand.length} 张）`);
  }

  // 已见口径：对手弃牌 + 自己暗牌 + 全部副露
  const seenCounts = new Array<number>(34).fill(0);
  for (const t of input.seen) seenCounts[tileIdToIndex(t)]++;
  for (let i = 0; i < 34; i++) seenCounts[i] += handCounts[i];
  for (const m of input.melded) for (const t of m.tiles) seenCounts[tileIdToIndex(t)]++;

  const waits = listWaits(handCounts, meldedSets, seenCounts, ruleset);
  const fans = waits.map((w) => {
    const counts = handCounts.slice();
    counts[tileIdToIndex(w.tile)]++;
    const fan = canWin(counts, {
      ruleset,
      melded: input.melded,
      selfDraw: false,
      menqing: input.melded.length === 0,
      flags: {},
    });
    return { tile: w.tile, fan: fan ?? ('cannotWin' as const) };
  });

  const insufficient = fans.filter((f) => f.fan === 'cannotWin').map((f) => f.tile);
  const startingFanHint =
    ruleset.startingFan > 0 && insufficient.length > 0
      ? `听 ${insufficient.join('、')} 不满足 ${ruleset.startingFan} 番起胡（此类鸡胡不可胡）`
      : null;

  return { waits, fans, startingFanHint };
}
