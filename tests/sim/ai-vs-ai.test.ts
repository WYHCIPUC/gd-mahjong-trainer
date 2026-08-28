import { describe, it, expect } from 'vitest';
import {
  newGame,
  autoStep,
  assertTileConservation,
  type GameState,
} from '../../src/app/game-controller';
import { decide } from '../../src/domain/ai/decider';
import { getRuleset } from '../../src/domain/rulesets';
import type { Difficulty } from '../../src/domain/ai/types';

const RULESETS = ['tuidaohu', 'jipinghu', 'gangshi'] as const;
const DIFFS: Difficulty[] = ['expert', 'intermediate', 'novice', 'intermediate'];

function playGame(seed: number, samples: number[], stats: { wins: number; draws: number }): void {
  let state: GameState = newGame({ seed, rulesetId: RULESETS[seed % 3] });
  let guard = 0;
  while (!state.result) {
    if (++guard > 3000) throw new Error(`对局 ${seed} 未终止`);
    const rs = getRuleset(state.rulesetId);
    const next = autoStep(state, (view) => {
      const t0 = performance.now();
      const d = decide(view, DIFFS[view.seat], rs);
      samples.push(performance.now() - t0);
      return d;
    });
    assertTileConservation(next);
    state = next;
  }
  if (state.result.type === 'win') stats.wins++;
  else stats.draws++;
}

describe('AI vs AI 模拟（SC-3）', () => {
  it('100 局冒烟：守恒不变量全程成立、无异常', { timeout: 300_000 }, () => {
    const samples: number[] = [];
    const stats = { wins: 0, draws: 0 };
    for (let g = 0; g < 100; g++) playGame(g, samples, stats);
    expect(stats.wins + stats.draws).toBe(100);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(`100 局: 胡牌 ${stats.wins} 流局 ${stats.draws}，决策 ${samples.length} 次，平均 ${avg.toFixed(2)}ms`);
  });

  it('1000 局：守恒不变量全程成立；非 CI 环境加验决策耗时（SC-3）', { timeout: 900_000 }, () => {
    const samples: number[] = [];
    const stats = { wins: 0, draws: 0 };
    for (let g = 100; g < 1100; g++) playGame(g, samples, stats);
    expect(stats.wins + stats.draws).toBe(1000);
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    console.log(
      `1000 局: 胡牌 ${stats.wins} 流局 ${stats.draws}，决策 ${samples.length} 次，平均 ${avg.toFixed(2)}ms，p99 ${p99.toFixed(2)}ms`,
    );
    // 耗时预算在本地/真机门槛验证（Task 33）；CI 的 2 核 runner 不具备代表性，仅保留守恒与完成断言
    if (!process.env.CI) {
      expect(avg).toBeLessThan(50); // SC-3：AI 单决策 < 50ms（均值）
      expect(p99).toBeLessThan(500); // 尾部护栏
    }
  });
});
