// 教练阈值校准脚本：对比 novice 与 expert 在随机对局每个决策点的出牌分歧，
// 统计「expert 相对 novice 的进张差」分布，给出 COACH_THRESHOLDS.ukeireDiff 的建议值。
// 用法：npm run calibrate [局数，默认 50]
import { newGame, autoStep, playerView, type GameState } from '../src/app/game-controller';
import { decide } from '../src/domain/ai/decider';
import { evalDiscards } from '../src/domain/ai/efficiency';
import { getRuleset } from '../src/domain/rulesets';
import type { Difficulty } from '../src/domain/ai/types';

const N = Number(process.argv[2] ?? 50);
const DIFFS: Difficulty[] = ['expert', 'intermediate', 'novice', 'intermediate'];
const diffs: number[] = [];

for (let g = 0; g < N; g++) {
  let state: GameState = newGame({ seed: 10000 + g, rulesetId: ['tuidaohu', 'jipinghu', 'gangshi'][g % 3] });
  let guard = 0;
  while (!state.result && guard++ < 3000) {
    if (state.phase === 'action') {
      const view = playerView(state, state.turn);
      const rs = getRuleset(state.rulesetId);
      const dNovice = decide(view, 'novice', rs);
      const dExpert = decide(view, 'expert', rs);
      if (dNovice.action.type === 'discard' && dExpert.action.type === 'discard') {
        const noviceTile = dNovice.action.tile;
        const expertTile = dExpert.action.tile;
        if (noviceTile !== expertTile) {
          const evals = evalDiscards(view, rs);
          const ne = evals.find((e) => e.tile === noviceTile);
          const ee = evals.find((e) => e.tile === expertTile);
          if (ne && ee) diffs.push(ee.ukeireTiles - ne.ukeireTiles);
        }
      }
      state = autoStep(state, (v) => decide(v, DIFFS[v.seat], rs));
    } else {
      state = autoStep(state, (v) => decide(v, DIFFS[v.seat], getRuleset(v.rulesetId)));
    }
  }
}

diffs.sort((a, b) => a - b);
const pct = (p: number): number => diffs[Math.floor(diffs.length * p)] ?? 0;
console.log(`样本 ${diffs.length} 个（novice 与 expert 出牌分歧点）`);
console.log(`进张差分布：p50=${pct(0.5)} p75=${pct(0.75)} p90=${pct(0.9)} p95=${pct(0.95)} max=${diffs[diffs.length - 1] ?? 0}`);
console.log(`建议 COACH_THRESHOLDS.ukeireDiff = ${Math.max(1, pct(0.75))}（当前值见 src/app/coach.ts，修改后请同步测试）`);
