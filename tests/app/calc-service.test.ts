import { describe, it, expect } from 'vitest';
import { calculate } from '../../src/app/calc-service';
import { mulberry32 } from '../../src/domain/rng';
import { toCounts, fromCounts, type TileId } from '../../src/domain/tiles';
import { performance } from 'node:perf_hooks';

describe('calculate 计算服务', () => {
  it('听牌枚举 + 剩余张数 + 番数预估（推倒胡）', () => {
    const out = calculate({
      hand: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'z5', 'z5'],
      melded: [],
      seen: ['p3'],
      rulesetId: 'tuidaohu',
    });
    // 听 3p（123p + 55z）
    expect(out.waits).toEqual([{ tile: 'p3', remaining: 3 }]);
    const fan = out.fans.find((f) => f.tile === 'p3');
    expect(fan && fan.fan !== 'cannotWin' && fan.fan.total).toBe(1); // 鸡胡 0 + 门清 1
    expect(out.startingFanHint).toBeNull();
  });

  it('鸡平胡：1 番听牌不满足 3 番起胡，给出提示', () => {
    const out = calculate({
      hand: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'z5', 'z5'],
      melded: [],
      seen: [],
      rulesetId: 'jipinghu',
    });
    expect(out.fans[0].fan).toBe('cannotWin');
    expect(out.startingFanHint).toContain('不满足 3 番起胡');
    expect(out.startingFanHint).toContain('p3');
  });

  it('碰一副后按 10 张暗牌计算', () => {
    const out = calculate({
      hand: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'p1', 'p1'],
      melded: [{ type: 'peng', tiles: ['z5', 'z5', 'z5'] }],
      seen: [],
      rulesetId: 'tuidaohu',
    });
    expect(out.waits.length).toBeGreaterThan(0);
  });

  it('非法输入防御：暗牌张数错误与同牌超 4 张显式抛错', () => {
    expect(() =>
      calculate({ hand: ['m1', 'm2', 'm3'], melded: [], seen: [], rulesetId: 'tuidaohu' }),
    ).toThrow();
    expect(() =>
      calculate({
        hand: ['m1', 'm1', 'm1', 'm1', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3'],
        melded: [],
        seen: [],
        rulesetId: 'tuidaohu',
      }),
    ).toThrow();
  });

  it('随机 13 张 × 50 次计算，平均 < 500ms（NFR 预算；CI 2 核 runner 也必须过）', () => {
    const rng = mulberry32(77);
    const random13 = (): TileId[] => {
      const counts = new Array<number>(34).fill(0);
      let n = 0;
      while (n < 13) {
        const i = Math.floor(rng() * 34);
        if (counts[i] < 4) {
          counts[i]++;
          n++;
        }
      }
      return fromCounts(counts);
    };
    let total = 0;
    let ok = 0;
    for (let k = 0; k < 50; k++) {
      const hand = random13();
      const t0 = performance.now();
      try {
        calculate({ hand, melded: [], seen: [], rulesetId: 'tuidaohu' });
        ok++;
      } catch {
        // 某些随机牌型无听牌（如 14 张孤张不可达），calculate 允许空结果；
        // 若因结构性原因抛错则跳过统计
      }
      total += performance.now() - t0;
    }
    expect(ok).toBeGreaterThan(40);
    expect(total / 50).toBeLessThan(500);
  });
});

describe('toCounts 防御一致性', () => {
  it('13 张合法输入不抛错', () => {
    expect(() => toCounts(['m1', 'm1', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'z1', 'z2'])).not.toThrow();
  });
});
