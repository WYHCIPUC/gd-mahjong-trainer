import { describe, it, expect } from 'vitest';
import { decomposeStandard, isChiitoiShape, isKokushiShape, validateDecomposition } from '../../src/domain/agari';
import { parseHandShorthand, tileIdToIndex } from '../../src/domain/tiles';

describe('agari 标准形分解', () => {
  it('九莲宝灯 +9m：恰有分解且全部合法', () => {
    const counts = parseHandShorthand('1112345678999m');
    counts[tileIdToIndex('m9')]++;
    const ds = decomposeStandard(counts);
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(validateDecomposition(d, 14)).toBe(true);
  });

  it('九莲宝灯 +1m：可分解', () => {
    const counts = parseHandShorthand('1112345678999m');
    counts[tileIdToIndex('m1')]++;
    const ds = decomposeStandard(counts);
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((d) => validateDecomposition(d, 14))).toBe(true);
  });

  it('常见听牌 123m456m789m12p55p +3p', () => {
    const counts = parseHandShorthand('123m456m789m12p55p');
    counts[tileIdToIndex('p3')]++;
    const ds = decomposeStandard(counts);
    expect(ds.length).toBe(1);
    expect(ds[0].pair).toBe('p5'); // 唯一胡形：123p + 55p 雀头
  });

  it('碰杠后的暗牌分解（暗牌 3 组 + 雀头）', () => {
    // 碰 999p，暗牌 12345678m55m 听 6m/9m，摸 9m 胡：123m+456m+789m+55m
    const counts = parseHandShorthand('12345678m55m');
    counts[tileIdToIndex('m9')]++;
    const ds = decomposeStandard(counts);
    expect(ds.length).toBeGreaterThan(0);
    expect(ds[0].sets.length).toBe(3);
  });

  it('不构成胡形返回空', () => {
    const counts = parseHandShorthand('123m456m789m1p9p5s9s');
    counts[tileIdToIndex('p1')]++;
    expect(decomposeStandard(counts)).toEqual([]);
  });

  it('分解无重复', () => {
    const counts = parseHandShorthand('11223344556677m');
    const ds = decomposeStandard(counts);
    const sigs = ds.map((d) => JSON.stringify([d.pair, d.sets.map((s) => [...s].sort().join('')).sort()]));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
});

describe('七对与十三幺形', () => {
  it('七对形判定', () => {
    expect(isChiitoiShape(parseHandShorthand('11223344556677m'))).toBe(true);
    expect(isChiitoiShape(parseHandShorthand('11123344556677m'))).toBe(false); // 含刻子
    expect(isChiitoiShape(parseHandShorthand('1122334455667m'))).toBe(false); // 13 张
  });

  it('十三幺形判定', () => {
    const ok = parseHandShorthand('19m19p19s1234567z');
    ok[tileIdToIndex('z7')]++;
    expect(isKokushiShape(ok)).toBe(true);
    expect(isKokushiShape(parseHandShorthand('11223344556677m'))).toBe(false);
  });
});
