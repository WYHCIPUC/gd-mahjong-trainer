// 规则引擎门面 [public]：承诺「输入局面、输出结果」接口只增不改。
import { shantenStandard, shantenChiitoi, shantenKokushi } from './shanten';
import { evaluateWin, type FanResult } from './score';
import type { WinContext } from './yaku';
import type { Ruleset } from './rulesets/types';
import type { GameAction, PlayerView } from './game-types';
import { indexToTileId, tileIdToIndex, toCounts } from './tiles';

/** 按 ruleset 启用的胡牌形取最小向听；-1 = 已构成胡形 */
export function shantenOf(hand: number[], meldedSets: number, ruleset: Ruleset): number {
  let best = Number.POSITIVE_INFINITY;
  if (ruleset.forms.standard) best = shantenStandard(hand, meldedSets);
  if (ruleset.forms.chiitoi && meldedSets === 0) best = Math.min(best, shantenChiitoi(hand));
  if (ruleset.forms.kokushi && meldedSets === 0) best = Math.min(best, shantenKokushi(hand));
  return best;
}

export interface Wait {
  tile: string;
  remaining: number; // 4 - 已见张数
}

/** 听牌枚举：hand 为 3n+1 张暗牌，返回每张可胡牌及实际剩余张数 */
export function listWaits(
  hand: number[],
  meldedSets: number,
  seenCounts: number[],
  ruleset: Ruleset,
): Wait[] {
  const waits: Wait[] = [];
  for (let t = 0; t < 34; t++) {
    if (seenCounts[t] >= 4) continue;
    hand[t]++;
    const s = shantenOf(hand, meldedSets, ruleset);
    hand[t]--;
    if (s === -1) waits.push({ tile: indexToTileId(t), remaining: 4 - seenCounts[t] });
  }
  return waits;
}

/** 胡形判定 + 番数；不可胡返回 null */
export function canWin(counts14: number[], ctx: WinContext): FanResult | null {
  const r = evaluateWin(counts14, ctx);
  return 'cannotWin' in r ? null : r;
}

const winCtx = (view: PlayerView, ruleset: Ruleset, selfDraw: boolean, flags: WinContext['flags']): WinContext => ({
  ruleset,
  melded: view.melds[view.seat],
  selfDraw,
  menqing: view.melds[view.seat].length === 0,
  flags,
});

/** 合法动作枚举（引擎层不裁决 flags 之外的策略问题） */
export function legalActions(
  view: PlayerView,
  ruleset: Ruleset,
  flags: WinContext['flags'] = {},
): GameAction[] {
  const actions: GameAction[] = [];
  const handCounts = toCounts(view.hand);

  if (view.phase === 'action') {
    // view.hand 在行动阶段已含刚摸的张（3n+2），直接参与自摸胡判定
    if (canWin(handCounts, winCtx(view, ruleset, true, flags))) {
      actions.push({ type: 'win', selfDraw: true });
    }
    for (let t = 0; t < 34; t++) {
      if (handCounts[t] > 0) actions.push({ type: 'discard', tile: indexToTileId(t) });
      const melds = view.melds[view.seat];
      if (handCounts[t] === 4) actions.push({ type: 'anGang', tile: indexToTileId(t) });
      if (
        handCounts[t] >= 1 &&
        melds.some((m) => m.type === 'peng' && tileIdToIndex(m.tiles[0]) === t)
      ) {
        actions.push({ type: 'buGang', tile: indexToTileId(t) });
      }
    }
    return actions;
  }

  if (view.phase === 'claims' && view.lastDiscard) {
    const { tile, from } = view.lastDiscard;
    const t = tileIdToIndex(tile);
    handCounts[t]++;
    if (canWin(handCounts, winCtx(view, ruleset, false, flags))) {
      actions.push({ type: 'win', selfDraw: false, tile });
    }
    handCounts[t]--;
    if (handCounts[t] >= 2) actions.push({ type: 'peng', from });
    if (handCounts[t] === 3) actions.push({ type: 'mingGang', from });
    const nextSeat = (from + 1) % 4;
    if (ruleset.allowsChi && view.seat === nextSeat && t < 27) {
      const base = Math.floor(t / 9) * 9;
      const pos = t % 9;
      const pushChi = (a: number, b: number): void => {
        if (handCounts[base + a] > 0 && handCounts[base + b] > 0) {
          actions.push({
            type: 'chi',
            tiles: [indexToTileId(base + a), indexToTileId(base + b)],
            from,
          });
        }
      };
      if (pos >= 2) pushChi(pos - 2, pos - 1);
      if (pos >= 1 && pos <= 7) pushChi(pos - 1, pos + 1);
      if (pos <= 6) pushChi(pos + 1, pos + 2);
    }
  }
  return actions;
}
