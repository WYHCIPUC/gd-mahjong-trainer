import { ALL_INDICES, indexToTileId, type TileId } from '../../domain/tiles';
import TileFace from './TileFace';

/** 34 种牌选择宫格：显示剩余张数（4 − 已见 − 手中），余 0 或手牌已满时禁用 */
export default function TilePicker({
  seenCounts,
  handCounts,
  handLimit,
  handUsed,
  onSelect,
}: {
  seenCounts: number[]; // 已见（不含手中）
  handCounts: number[]; // 手中各牌张数
  handLimit: number;
  handUsed: number;
  onSelect: (tile: TileId) => void;
}) {
  return (
    <div className="tile-picker" data-testid="tile-picker">
      {ALL_INDICES.map((i) => {
        const tile = indexToTileId(i);
        const remaining = 4 - seenCounts[i] - handCounts[i];
        const disabled = remaining <= 0 || handUsed >= handLimit;
        return (
          <TileFace
            key={tile}
            tile={tile}
            size="sm"
            badge={remaining}
            disabled={disabled}
            testId={`pick-${tile}`}
            onClick={() => {
              if (!disabled) onSelect(tile);
            }}
          />
        );
      })}
    </div>
  );
}
