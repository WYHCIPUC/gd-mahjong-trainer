// 教练服务：粘合层。玩家每次出牌后与同难度 AI 决策对比，偏差超阈值即时提示；
// 局后汇总「关键分歧点」（设计文档·组件清单 #4）。阈值为 [experimental]，由校准脚本校准。
import { decide } from '../domain/ai/decider';
import { evalDiscards } from '../domain/ai/efficiency';
import type { Difficulty, Decision } from '../domain/ai/types';
import type { GameAction, PlayerView } from '../domain/game-types';
import { getRuleset } from '../domain/rulesets';
import type { TileId } from '../domain/tiles';

/** ⚠️ experimental：进张差 ≥ 2 或向听更差才提示（实现期用 AI vs AI 回放校准） */
export const COACH_THRESHOLDS = { ukeireDiff: 2, shantenDiff: 1 };

export interface CoachHint {
  text: string;
  aiTile: TileId;
  playerTile: TileId;
  ukeireDiff: number;
  shantenDiff: number;
}

export interface Divergence {
  step: number;
  playerTile: TileId;
  aiTile: TileId;
  playerUkeire: number;
  aiUkeire: number;
  aiReason: string;
}

export interface TurnEvaluation {
  hint: CoachHint | null;
  aiDecision: Decision;
  divergence: Divergence | null;
}

export function evaluateTurn(
  view: PlayerView,
  playerAction: GameAction,
  difficulty: Difficulty,
): TurnEvaluation {
  const ruleset = getRuleset(view.rulesetId);
  const aiDecision = decide(view, difficulty, ruleset);
  if (playerAction.type !== 'discard' || aiDecision.action.type !== 'discard') {
    return { hint: null, aiDecision, divergence: null };
  }
  const playerTile = playerAction.tile;
  const aiTile = aiDecision.action.type === 'discard' ? aiDecision.action.tile : playerTile;
  if (playerTile === aiTile) return { hint: null, aiDecision, divergence: null };

  const evals = evalDiscards(view, ruleset);
  const pe = evals.find((e) => e.tile === playerTile);
  const ae = evals.find((e) => e.tile === aiTile);
  if (!pe || !ae) return { hint: null, aiDecision, divergence: null };

  const ukeireDiff = ae.ukeireTiles - pe.ukeireTiles;
  const shantenDiff = pe.shantenAfter - ae.shantenAfter;
  const overThreshold =
    shantenDiff >= COACH_THRESHOLDS.shantenDiff || (shantenDiff >= 0 && ukeireDiff >= COACH_THRESHOLDS.ukeireDiff);
  const hint: CoachHint | null = overThreshold
    ? {
        text: `同难度 AI 会打 ${aiTile}：有效进张 ${ae.ukeireTiles} 张，你打 ${playerTile} 只剩 ${pe.ukeireTiles} 张`,
        aiTile,
        playerTile,
        ukeireDiff,
        shantenDiff,
      }
    : null;
  const divergence: Divergence | null = overThreshold
    ? {
        step: 0,
        playerTile,
        aiTile,
        playerUkeire: pe.ukeireTiles,
        aiUkeire: ae.ukeireTiles,
        aiReason: aiDecision.reasons.map((r) => r.text).join('；'),
      }
    : null;
  return { hint, aiDecision, divergence };
}
