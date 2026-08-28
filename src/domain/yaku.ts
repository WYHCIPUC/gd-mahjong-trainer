// 番种判定谓词注册表：新增番种 = 注册谓词 + ruleset 数据，不改 score.ts。
import type { Decomposition, MeldRef } from './agari';
import type { Ruleset } from './rulesets/types';
import type { TileId } from './tiles';

export const PREDICATE_IDS = [
  'base', // 任何胡形
  'zimo', // 自摸
  'menqing', // 门前清（无任何碰杠）
  'duiduihu', // 碰碰胡
  'hunyise', // 混一色
  'qingyise', // 清一色
  'chiitoi', // 七对
  'hunlaotou', // 混老头
  'qinglaotou', // 清老头
  'ziyise', // 字一色
  'dasixi', // 大四喜
  'xiaosixi', // 小四喜
  'dasanyuan', // 大三元
  'xiaosanyuan', // 小三元
  'gangkai', // 杠上开花
  'qianggang', // 抢杠胡
  'haidi', // 海底捞月
  'tianhu', // 天胡
  'dihu', // 地胡
  'shisanyao', // 十三幺
  'kankahu', // 坎坎胡（四暗刻）
  'yisesantongshun', // 一色三同顺
  'yisesanjiegao', // 一色三节高
] as const;

export type PredicateId = (typeof PREDICATE_IDS)[number];

export interface WinContext {
  ruleset: Ruleset;
  melded: MeldRef[];
  selfDraw: boolean;
  /** 无任何副露（暗杠不破门清） */
  menqing: boolean;
  flags: { gangKai?: boolean; qiangGang?: boolean; haiDi?: boolean; tianHu?: boolean; diHu?: boolean };
}

type Predicate = (d: Decomposition, ctx: WinContext) => boolean;

// ── 牌面小工具 ──
const suitOf = (t: TileId) => t[0];
const rankOf = (t: TileId) => Number(t.slice(1));
const isHonor = (t: TileId) => suitOf(t) === 'z';
const isTerminal = (t: TileId) => !isHonor(t) && (rankOf(t) === 1 || rankOf(t) === 9);
const isWind = (t: TileId) => isHonor(t) && rankOf(t) <= 4;
const isDragon = (t: TileId) => isHonor(t) && rankOf(t) >= 5;
const isTripletSet = (s: TileId[]) => s[0] === s[1] && s[1] === s[2];
const meldIsTriplet = (m: MeldRef) => m.type !== 'chi';

const allTiles = (d: Decomposition, melded: MeldRef[]): TileId[] => [
  d.pair,
  ...d.sets.flat(),
  ...melded.flatMap((m) => m.tiles),
];

/** 三元组刻子（暗刻 + 明碰/杠）中匹配过滤条件的组数 */
const tripletCount = (d: Decomposition, melded: MeldRef[], tile: (t: TileId) => boolean): number => {
  let n = 0;
  for (const s of d.sets) if (isTripletSet(s) && tile(s[0])) n++;
  for (const m of melded) if (m.type !== 'chi' && tile(m.tiles[0])) n++;
  return n;
};

export const YAKU_PREDICATES: Record<PredicateId, Predicate> = {
  base: () => true,
  zimo: (_d, c) => c.selfDraw,
  menqing: (_d, c) => c.menqing,
  duiduihu: (d, c) => d.sets.every(isTripletSet) && c.melded.every(meldIsTriplet),
  hunyise: (d, c) => {
    const ts = allTiles(d, c.melded);
    const suits = new Set(ts.filter((t) => !isHonor(t)).map(suitOf));
    return suits.size === 1 && ts.some(isHonor);
  },
  qingyise: (d, c) => {
    const ts = allTiles(d, c.melded);
    return ts.length > 0 && !ts.some(isHonor) && new Set(ts.map(suitOf)).size === 1;
  },
  hunlaotou: (d, c) => {
    const ts = allTiles(d, c.melded);
    return ts.every((t) => isTerminal(t) || isHonor(t)) && ts.some(isTerminal)
      && d.sets.every(isTripletSet) && c.melded.every(meldIsTriplet);
  },
  qinglaotou: (d, c) => allTiles(d, c.melded).every(isTerminal),
  ziyise: (d, c) => allTiles(d, c.melded).every(isHonor),
  dasixi: (d, c) => tripletCount(d, c.melded, isWind) === 4,
  xiaosixi: (d, c) => tripletCount(d, c.melded, isWind) === 3 && isWind(d.pair),
  dasanyuan: (d, c) => tripletCount(d, c.melded, isDragon) === 3,
  xiaosanyuan: (d, c) => tripletCount(d, c.melded, isDragon) === 2 && isDragon(d.pair),
  kankahu: (d, c) => c.menqing && d.sets.length === 4 && d.sets.every(isTripletSet),
  gangkai: (_d, c) => !!c.flags.gangKai,
  qianggang: (_d, c) => !!c.flags.qiangGang,
  haidi: (_d, c) => !!c.flags.haiDi,
  tianhu: (_d, c) => !!c.flags.tianHu,
  dihu: (_d, c) => !!c.flags.diHu,
  // 七对/十三幺不走标准形分解，由 score 的专用路径特判
  chiitoi: () => false,
  shisanyao: () => false,
  yisesantongshun: (d, c) => {
    const sigs: string[] = [];
    for (const s of d.sets) {
      if (!isTripletSet(s) && s[0][0] !== 'z') sigs.push([...s].sort().join(''));
    }
    for (const m of c.melded) if (m.type === 'chi') sigs.push([...m.tiles].sort().join(''));
    const counts = new Map<string, number>();
    for (const sig of sigs) counts.set(sig, (counts.get(sig) ?? 0) + 1);
    return [...counts.values()].some((n) => n >= 3);
  },
  yisesanjiegao: (d, c) => {
    const bySuit = new Map<string, number[]>();
    const addTriplet = (t0: TileId): void => {
      const suit = suitOf(t0);
      if (suit === 'z') return;
      if (!bySuit.has(suit)) bySuit.set(suit, []);
      bySuit.get(suit)!.push(rankOf(t0));
    };
    for (const s of d.sets) if (isTripletSet(s)) addTriplet(s[0]);
    for (const m of c.melded) if (m.type !== 'chi') addTriplet(m.tiles[0]);
    for (const ranks of bySuit.values()) {
      const sorted = [...new Set(ranks)].sort((a, b) => a - b);
      for (let i = 0; i + 2 < sorted.length; i++) {
        if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) return true;
      }
    }
    return false;
  },
};
