import type { TileId } from '../../domain/tiles';

const SUIT_CLASS: Record<string, string> = { m: 'tile-m', p: 'tile-p', s: 'tile-s', z: 'tile-z' };
const SUIT_NAME: Record<string, string> = { m: '万', p: '筒', s: '条', z: '' };

export default function TileFace({
  tile,
  size = 'md',
  onClick,
  disabled = false,
  testId,
  badge,
}: {
  tile: TileId;
  size?: 'sm' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
  badge?: string | number;
}) {
  const suit = tile[0];
  const rank = tile.slice(1);
  const cls = `tile-face ${SUIT_CLASS[suit]} tile-${size}`;
  if (onClick) {
    return (
      <button className={cls} onClick={onClick} disabled={disabled} data-testid={testId} type="button">
        <span className="tile-rank">{rank}</span>
        <span className="tile-suit">{SUIT_NAME[suit]}</span>
        {badge !== undefined && <span className="tile-badge">{badge}</span>}
      </button>
    );
  }
  return (
    <span className={cls} data-testid={testId}>
      <span className="tile-rank">{rank}</span>
      <span className="tile-suit">{SUIT_NAME[suit]}</span>
      {badge !== undefined && <span className="tile-badge">{badge}</span>}
    </span>
  );
}
