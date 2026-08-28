// 防守危险度（v1 简化模型，可解释优先）：0 = 安全，100 = 极危。
// 依据：现物（对手弃牌）安全；已见张数越多越安全；数牌按筋位置降权。
// 已知简化（写入教学理由时须说明）：现物只对打出者完全安全，v1 对所有对手按安全处理。
import type { PlayerView } from '../game-types';
import { tileIdToIndex, type TileId } from '../tiles';

const NUMBER_BASE: Record<number, number> = { 1: 50, 2: 55, 3: 60, 4: 70, 5: 75, 6: 70, 7: 60, 8: 55, 9: 50 };

export function tileDanger(tile: TileId, view: PlayerView): number {
  const t = tileIdToIndex(tile);
  const isHonor = t >= 27;

  // 四张全见：不可能点炮
  if (view.seenCounts[t] >= 4) return 0;

  // 现物：任一对手弃牌出现过（v1 简化）
  for (let seat = 0; seat < 4; seat++) {
    if (seat === view.seat) continue;
    if (view.discards[seat].some((d) => tileIdToIndex(d) === t)) return 0;
  }

  const seen = view.seenCounts[t];
  if (isHonor) {
    return [90, 60, 30, 0][Math.min(seen, 3)];
  }
  const rank = t % 9 + 1;
  return Math.max(0, NUMBER_BASE[rank] - 12 * seen);
}
