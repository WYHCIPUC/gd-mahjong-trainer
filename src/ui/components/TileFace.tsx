import type { TileId } from '../../domain/tiles';

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUIT_CN = { m: '萬', p: '筒', s: '條' } as const;
const WIND = ['', '東', '南', '西', '北'];

/**
 * 仿真牌面：象牙底、3D 边缘、繁体牌字（萬/發），万=蓝、筒=绿、条=红，
 * 字牌東南西北深色、红中、绿发、白板为蓝框。
 * className 恒含 tile-face（E2E 选择器依赖），尺寸 sm/md。
 */
export default function TileFace({
  tile,
  size = 'md',
  onClick,
  disabled = false,
  testId,
  badge,
  highlight = false,
}: {
  tile: TileId;
  size?: 'sm' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
  badge?: string | number;
  highlight?: boolean;
}) {
  const suit = tile[0];
  const rank = Number(tile.slice(1));
  const cls = `tile-face tile-${size} tile-${suit}${highlight ? ' tile-drawn' : ''}`;
  const isButton = !!onClick || disabled;

  let face;
  if (suit === 'z') {
    if (rank === 7) {
      face = <span className="tile-bai-frame" aria-label="白板" />;
    } else {
      face = (
        <span className={`tile-num ${rank === 6 ? 'honor-zhong' : rank === 5 ? 'honor-fa' : 'honor-wind'}`}>
          {WIND[rank] ?? rank}
        </span>
      );
    }
  } else {
    face = (
      <>
        <span className="tile-num">{NUM_CN[rank]}</span>
        <span className="tile-suit-char">{SUIT_CN[suit as keyof typeof SUIT_CN]}</span>
      </>
    );
  }

  if (isButton) {
    return (
      <button className={cls} onClick={onClick} disabled={disabled} data-testid={testId} type="button">
        {face}
        {badge !== undefined && <span className="tile-badge">{badge}</span>}
      </button>
    );
  }
  return (
    <span className={cls} data-testid={testId}>
      {face}
      {badge !== undefined && <span className="tile-badge">{badge}</span>}
    </span>
  );
}
