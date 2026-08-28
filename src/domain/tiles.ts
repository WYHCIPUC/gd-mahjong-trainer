// 牌定义：34 种牌（万 m / 筒 p / 条 s 各 1-9，字 z 1-7），每种 4 张，共 136 张。
// 计算密集处使用 34 维计数向量；索引 0-8 万、9-17 筒、18-26 条、27-33 字。
export type TileSuit = 'm' | 'p' | 's' | 'z';
export type TileId = string; // "m1".."m9"|"p1".."p9"|"s1".."s9"|"z1".."z7"

const SUIT_BASE: Record<TileSuit, number> = { m: 0, p: 9, s: 18, z: 27 };

export const tileIdToIndex = (id: TileId): number => {
  const suit = id[0] as TileSuit;
  const rank = Number(id.slice(1));
  const base = SUIT_BASE[suit];
  const max = suit === 'z' ? 7 : 9;
  if (Number.isNaN(rank) || base === undefined || rank < 1 || rank > max) {
    throw new Error(`非法牌: ${id}`);
  }
  return base + rank - 1;
};

export const indexToTileId = (i: number): TileId => {
  if (!Number.isInteger(i) || i < 0 || i > 33) throw new Error(`非法索引: ${i}`);
  const suit = (['m', 'p', 's', 'z'] as const)[Math.floor(i / 9)];
  return `${suit}${(i % 9) + 1}`;
};

export const ALL_INDICES = Array.from({ length: 34 }, (_, i) => i);

const SUIT_CN: Partial<Record<TileSuit, string>> = { m: '万', p: '筒', s: '条' };
const RANK_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONOR_CN = ['', '东风', '南风', '西风', '北风', '发财', '红中', '白板'];

/** 玩家可读牌名：m1 → 一万，z1 → 东风，z7 → 白板 */
export const tileName = (id: TileId): string => {
  const suit = id[0] as TileSuit;
  const rank = Number(id.slice(1));
  if (suit === 'z') return HONOR_CN[rank] ?? id;
  return `${RANK_CN[rank] ?? rank}${SUIT_CN[suit]}`;
};

/** 牌名列表：「三万·四万」 */
export const tileNames = (ids: TileId[]): string => ids.map(tileName).join('·');

export const toCounts = (ids: TileId[]): number[] => {
  const counts = new Array<number>(34).fill(0);
  for (const id of ids) {
    const i = tileIdToIndex(id);
    counts[i]++;
    if (counts[i] > 4) throw new Error(`同牌超 4 张: ${id}`);
  }
  return counts;
};

export const fromCounts = (counts: number[]): TileId[] => {
  const out: TileId[] = [];
  counts.forEach((c, i) => {
    if (c > 4) throw new Error(`同牌超 4 张: ${indexToTileId(i)}`);
    for (let k = 0; k < c; k++) out.push(indexToTileId(i));
  });
  return out;
};

/** 简写手牌串 → 34 向量，如 "1112345678999m"（花色字母后置，同段共用一个字母） */
export const parseHandShorthand = (s: string): number[] => {
  const counts = new Array<number>(34).fill(0);
  let digits = '';
  for (const ch of s) {
    if (ch >= '1' && ch <= '9') digits += ch;
    else if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
      for (const d of digits) counts[tileIdToIndex(`${ch}${d}`)]++;
      digits = '';
    } else throw new Error(`非法手牌串: ${s}`);
  }
  if (digits) throw new Error(`手牌串缺少花色后缀: ${s}`);
  return counts;
};
