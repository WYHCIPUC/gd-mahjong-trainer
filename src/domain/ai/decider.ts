// 加权决策器：确定性启发式，三档难度（设计决策 #7）。
// novice = 纯效率；intermediate = 效率 - 危险度；expert = 再加番数方向倾斜。
// 全部输出结构化 DecisionReason，渲染成人话是教学核心（[internal]，结构可迭代）。
import { evalDiscards, scoreOf, fanExpectation, type DiscardEval } from './efficiency';
import { tileDanger } from './defense';
import type { Decision, DecisionReason, Difficulty } from './types';
import type { PlayerView } from '../game-types';
import type { Ruleset } from '../rulesets/types';
import { legalActions, shantenOf, canWin } from '../engine';
import type { WinContext } from '../yaku';
import { toCounts, tileIdToIndex, type TileId } from '../tiles';

const DANGER_WEIGHT: Record<Difficulty, number> = { novice: 0, intermediate: 0.8, expert: 0.8 };
const FAN_WEIGHT: Record<Difficulty, number> = { novice: 0, intermediate: 0, expert: 4 };

/** 单候选评分（导出供教练服务复用与测试） */
export function scoreCandidate(
  e: DiscardEval,
  danger: number,
  difficulty: Difficulty,
  need: number,
  fanTilt: number,
): number {
  return scoreOf(e, need) - DANGER_WEIGHT[difficulty] * danger + FAN_WEIGHT[difficulty] * fanTilt;
}

/** 番数方向倾斜 0-1：花色集中时，打字牌/旁suit牌加分（清/混一色方向） */
function fanTiltFor(view: PlayerView, discardTile: TileId): number {
  const hand = toCounts(view.hand);
  const suitTiles = [0, 0, 0, 0];
  for (let t = 0; t < 34; t++) suitTiles[Math.floor(t / 9)] += hand[t];
  const numberTotal = suitTiles[0] + suitTiles[1] + suitTiles[2];
  if (numberTotal === 0) return 0;
  const maxSuit = Math.max(suitTiles[0], suitTiles[1], suitTiles[2]);
  const ratio = maxSuit / numberTotal;
  if (ratio < 0.55) return 0;
  const d = tileIdToIndex(discardTile);
  if (d >= 27) return 1; // 打字牌
  if (Math.floor(d / 9) !== [suitTiles[0], suitTiles[1], suitTiles[2]].indexOf(maxSuit)) return 0.7; // 打旁种
  return 0;
}

function confidenceOf(margin: number): number {
  if (margin <= 0) return 0;
  return Math.min(1, margin / 30);
}

function decideDiscard(view: PlayerView, difficulty: Difficulty, ruleset: Ruleset): Decision {
  // 自摸已胡：直接胡（v1 不做默胡策略）
  const flags: WinContext['flags'] = {};
  if (canWin(toCounts(view.hand), { ruleset, melded: view.melds[view.seat], selfDraw: true, menqing: view.melds[view.seat].length === 0, flags })) {
    return {
      action: { type: 'win', selfDraw: true },
      score: 1000,
      confidence: 1,
      reasons: [{ kind: 'claim', text: '已经胡牌，直接胡' }],
    };
  }

  const need = 4 - view.melds[view.seat].length;
  const evals = evalDiscards(view, ruleset);
  const scored = evals.map((e) => {
    const danger = tileDanger(e.tile, view);
    const fanTilt = fanTiltFor(view, e.tile);
    return { e, danger, fanTilt, score: scoreCandidate(e, danger, difficulty, need, fanTilt) };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const margin = best.score - (scored[1]?.score ?? 0);

  const reasons: DecisionReason[] = [
    {
      kind: 'efficiency',
      text: `打 ${best.e.tile} 后向听 ${best.e.shantenAfter}，有效进张 ${best.e.ukeireTiles} 张`,
      data: { shanten: best.e.shantenAfter, ukeire: best.e.ukeireTiles },
    },
  ];
  if (DANGER_WEIGHT[difficulty] > 0 && best.danger > 0) {
    reasons.push({
      kind: 'danger',
      text: `${best.e.tile} 危险度 ${best.danger}/100，已按风险折算`,
      data: { danger: best.danger },
    });
  }
  if (best.fanTilt > 0) {
    reasons.push({
      kind: 'fan',
      text: `手牌花色集中，打 ${best.e.tile} 保留混一色/清一色方向（番数期望约 ${fanExpectation(view)} 番）`,
    });
  }
  return {
    action: { type: 'discard', tile: best.e.tile },
    score: best.score,
    confidence: confidenceOf(margin),
    reasons,
  };
}

function decideClaim(view: PlayerView, difficulty: Difficulty, ruleset: Ruleset): Decision {
  void difficulty;
  const actions = legalActions(view, ruleset);
  const win = actions.find((a) => a.type === 'win');
  if (win) {
    return { action: win, score: 1000, confidence: 1, reasons: [{ kind: 'claim', text: '可以胡牌，直接胡' }] };
  }
  const { tile } = view.lastDiscard!;
  const t = tileIdToIndex(tile);
  const hand = toCounts(view.hand);
  const melds = view.melds[view.seat].length;
  const curShanten = shantenOf(hand, melds, ruleset);

  const gang = actions.find((a) => a.type === 'mingGang');
  if (gang) {
    // 明杠免费再摸一张，v1 恒杠
    return {
      action: gang,
      score: 500,
      confidence: 1,
      reasons: [{ kind: 'claim', text: `明杠 ${tile} 后可再摸一张牌` }],
    };
  }

  const peng = actions.find((a) => a.type === 'peng');
  const chi = actions.find((a) => a.type === 'chi');
  const claim = peng ?? chi;
  if (claim) {
    if (claim.type === 'peng') {
      hand[t] -= 2; // 手中的对子进副露
    } else if (claim.type === 'chi') {
      for (const x of claim.tiles) hand[tileIdToIndex(x)]--; // 手中的搭子两张进副露
    }
    const after = shantenOf(hand, melds + 1, ruleset);
    if (after < curShanten) {
      return {
        action: claim,
        score: 100 + (curShanten - after) * 100,
        confidence: 0.8,
        reasons: [
          { kind: 'claim', text: `${claim.type === 'peng' ? '碰' : '吃'} ${tile} 后向听从 ${curShanten} 降到 ${after}`, data: { before: curShanten, after } },
        ],
      };
    }
  }
  return {
    action: { type: 'pass' },
    score: 0,
    confidence: 1,
    reasons: [{ kind: 'claim', text: '宣称不降低向听，跳过' }],
  };
}

export function decide(view: PlayerView, difficulty: Difficulty, ruleset: Ruleset): Decision {
  if (view.phase === 'action') return decideDiscard(view, difficulty, ruleset);
  if (view.phase === 'claims') return decideClaim(view, difficulty, ruleset);
  throw new Error(`阶段 ${view.phase} 无决策`);
}
