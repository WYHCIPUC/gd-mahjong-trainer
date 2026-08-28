import { describe, it, expect } from 'vitest';
import casesJson from './fixtures/shanten-cases.json';
import { shantenStandard, shantenChiitoi, shantenKokushi } from '../../src/domain/shanten';
import { parseHandShorthand } from '../../src/domain/tiles';
import { mulberry32 } from '../../src/domain/rng';

interface ShantenCase {
  name: string;
  hand: string;
  melded?: number;
  standard?: number;
  chiitoi?: number;
  kokushi?: number;
}
const cases = casesJson as unknown as ShantenCase[];

describe.each(cases)('$name', (c) => {
  it(`standard=${c.standard ?? '-'} chiitoi=${c.chiitoi ?? '-'} kokushi=${c.kokushi ?? '-'}`, () => {
    const counts = parseHandShorthand(c.hand);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(13 - 3 * (c.melded ?? 0)); // 用例本身牌数自洽
    if (c.standard !== undefined) expect(shantenStandard(counts, c.melded ?? 0)).toBe(c.standard);
    if (c.chiitoi !== undefined) expect(shantenChiitoi(counts)).toBe(c.chiitoi);
    if (c.kokushi !== undefined) expect(shantenKokushi(counts)).toBe(c.kokushi);
  });
});

describe('向听数性能', () => {
  it('随机 13 张 × 500 次，平均 < 50ms/次（CI 2 核 runner 也必须过；真机门槛另测）', () => {
    const rng = mulberry32(3);
    const random13 = (): number[] => {
      const counts = new Array<number>(34).fill(0);
      let n = 0;
      while (n < 13) {
        const i = Math.floor(rng() * 34);
        if (counts[i] < 4) { counts[i]++; n++; }
      }
      return counts;
    };
    let total = 0;
    for (let n = 0; n < 500; n++) {
      const counts = random13();
      const t0 = performance.now();
      shantenStandard(counts);
      total += performance.now() - t0;
    }
    expect(total / 500).toBeLessThan(50);
  });
});
