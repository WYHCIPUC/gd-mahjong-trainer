import { describe, it, expect } from 'vitest';
import { mulberry32, buildWall, WALL_SIZE } from '../../src/domain/rng';

describe('rng / 牌墙', () => {
  it('同 seed 序列一致，不同 seed 不同', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(7);
    const sa = [a(), a(), a()];
    const sb = [b(), b(), b()];
    const sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('牌墙 136 张且每牌恰 4 张', () => {
    const wall = buildWall(mulberry32(1));
    expect(wall.length).toBe(WALL_SIZE); // 136
    const counts = new Array(34).fill(0);
    wall.forEach((t) => counts[t.tileIndex]++);
    expect(counts.every((c) => c === 4)).toBe(true);
  });

  it('同 seed 牌墙一致，copy 编号区分同种实体', () => {
    const w1 = buildWall(mulberry32(9));
    const w2 = buildWall(mulberry32(9));
    expect(w1.map((t) => t.tileIndex)).toEqual(w2.map((t) => t.tileIndex));
    expect(w1.map((t) => `${t.tileIndex}-${t.copy}`)).toEqual(w2.map((t) => `${t.tileIndex}-${t.copy}`));
    // 每种的 4 个实体 copy 编号各不相同
    const byIndex = new Map<number, Set<number>>();
    for (const t of w1) {
      if (!byIndex.has(t.tileIndex)) byIndex.set(t.tileIndex, new Set());
      byIndex.get(t.tileIndex)!.add(t.copy);
    }
    for (const copies of byIndex.values()) expect(copies.size).toBe(4);
  });
});
