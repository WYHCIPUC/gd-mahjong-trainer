import { describe, it, expect } from 'vitest';
import { toCounts, fromCounts, tileIdToIndex, indexToTileId, ALL_INDICES } from '../../src/domain/tiles';

describe('tiles', () => {
  it('TileId → 索引互逆', () => {
    expect(tileIdToIndex('m1')).toBe(0);
    expect(tileIdToIndex('m9')).toBe(8);
    expect(tileIdToIndex('p1')).toBe(9);
    expect(tileIdToIndex('s9')).toBe(26);
    expect(tileIdToIndex('z1')).toBe(27);
    expect(tileIdToIndex('z7')).toBe(33);
    for (const i of ALL_INDICES) expect(tileIdToIndex(indexToTileId(i))).toBe(i);
  });

  it('toCounts/fromCounts 互逆且牌数守恒', () => {
    const ids = ['m1', 'm1', 'm2', 'm3', 'p4', 'p4', 's7', 'z5', 'z5', 'z6'];
    const counts = toCounts(ids);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(ids.length);
    expect(counts[tileIdToIndex('m1')]).toBe(2);
    expect(fromCounts(counts)).toEqual(ids);
  });

  it('同一牌最多 4 张', () => {
    expect(() => toCounts(['m1', 'm1', 'm1', 'm1', 'm1'])).toThrow();
  });

  it('非法牌名抛错', () => {
    expect(() => tileIdToIndex('x1')).toThrow();
    expect(() => tileIdToIndex('z8')).toThrow();
    expect(() => tileIdToIndex('m0')).toThrow();
  });
});
