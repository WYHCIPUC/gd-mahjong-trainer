import { describe, it, expect } from 'vitest';
import { evaluateWin } from '../../src/domain/score';
import type { WinContext } from '../../src/domain/yaku';
import { getRuleset } from '../../src/domain/rulesets';
import type { MeldRef } from '../../src/domain/agari';
import { parseHandShorthand, tileIdToIndex, type TileId } from '../../src/domain/tiles';

interface Case {
  name: string;
  ruleset: string;
  hand13: string;
  winTile: TileId;
  melded?: MeldRef[];
  selfDraw?: boolean;
  flags?: WinContext['flags'];
  expectTotal?: number;
  expectCapped?: boolean;
  contains?: string[];
  /** 任一命中即可（存在多个等价分解时的两可番种） */
  containsAny?: string[];
  notContains?: string[];
  cannotWin?: 'no-shape' | 'below-starting-fan';
}

const win = (hand13: string, winTile: TileId): number[] => {
  const counts = parseHandShorthand(hand13);
  counts[tileIdToIndex(winTile)]++;
  return counts;
};

const CASES: Case[] = [
  {
    name: '推倒胡·鸡胡+门清=1', ruleset: 'tuidaohu', hand13: '123m456m789m12p55p', winTile: 'p3',
    expectTotal: 1, contains: ['jihu'],
  },
  {
    name: '推倒胡·鸡胡+门清+自摸=2', ruleset: 'tuidaohu', hand13: '123m456m789m12p55p', winTile: 'p3', selfDraw: true,
    expectTotal: 2, contains: ['zimo'],
  },
  {
    name: '推倒胡·碰碰胡+门清=7', ruleset: 'tuidaohu', hand13: '111m222m333m444p5p', winTile: 'p5',
    expectTotal: 7, contains: ['duiduihu'],
  },
  {
    name: '推倒胡·碰碰胡+混一色=13（无清一色/混老头）', ruleset: 'tuidaohu', hand13: '111m222m333m999m5z', winTile: 'z5',
    expectTotal: 13, contains: ['duiduihu', 'hunyise'], notContains: ['qingyise', 'hunlaotou'],
  },
  {
    name: '推倒胡·混老头（排除碰碰胡，非清老头/字一色）', ruleset: 'tuidaohu', hand13: '111m999m111p5z999s', winTile: 'z5',
    expectTotal: 13, contains: ['hunlaotou'], notContains: ['duiduihu', 'qinglaotou', 'ziyise'],
  },
  {
    name: '推倒胡·清老头=25（排除混老头/碰碰胡）', ruleset: 'tuidaohu', hand13: '111m999m111p9p999s', winTile: 'p9',
    expectTotal: 25, contains: ['qinglaotou'], notContains: ['hunlaotou', 'duiduihu', 'qingyise'],
  },
  {
    name: '推倒胡·清一色+门清=13', ruleset: 'tuidaohu', hand13: '123m456m789m123m5m', winTile: 'm5',
    expectTotal: 13, contains: ['qingyise'], notContains: ['hunyise'],
  },
  {
    name: '推倒胡·字牌七对=13（仅七对路径）', ruleset: 'tuidaohu', hand13: '1122334455667z', winTile: 'z7',
    expectTotal: 13, contains: ['chiitoi'],
  },
  {
    name: '推倒胡·杠上开花加番', ruleset: 'tuidaohu', hand13: '123m456m789m12p55p', winTile: 'p3',
    selfDraw: true, flags: { gangKai: true },
    expectTotal: 3, contains: ['gangkai'],
  },
  {
    name: '推倒胡·天胡', ruleset: 'tuidaohu', hand13: '123m456m789m12p55p', winTile: 'p3',
    selfDraw: true, flags: { tianHu: true },
    expectTotal: 26, contains: ['tianhu'],
  },
  {
    name: '鸡平胡·平胡点炮不足起胡3番', ruleset: 'jipinghu', hand13: '123m456m789m12p55p', winTile: 'p3',
    cannotWin: 'below-starting-fan',
  },
  {
    name: '鸡平胡·碰碰胡=4', ruleset: 'jipinghu', hand13: '111m222m333m444p5p', winTile: 'p5',
    expectTotal: 4, contains: ['duiduihu'],
  },
  {
    name: '鸡平胡·9番封顶为8', ruleset: 'jipinghu', hand13: '111m222m333m999m5z', winTile: 'z5', selfDraw: true,
    flags: { haiDi: true },
    expectTotal: 8, expectCapped: true, contains: ['hunyise', 'haidi'],
  },
  {
    name: '港式·平胡+门清=2不足起胡3番', ruleset: 'gangshi', hand13: '123m123m456p789p5m', winTile: 'm5',
    cannotWin: 'below-starting-fan',
  },
  {
    name: '港式·十三幺封顶8', ruleset: 'gangshi', hand13: '19m19p19s1234567z', winTile: 'z7',
    expectTotal: 8, expectCapped: true, contains: ['shisanyao'],
  },
  {
    name: '港式·四暗刻+清一色封顶8', ruleset: 'gangshi', hand13: '111m222m333m444m5m', winTile: 'm5',
    expectTotal: 8, expectCapped: true, contains: ['kankahu', 'qingyise'],
  },
  {
    name: '港式·一色三同顺（与三节高两可）封顶8', ruleset: 'gangshi', hand13: '123m123m123m456m5m', winTile: 'm5',
    expectTotal: 8, expectCapped: true, containsAny: ['yisesantongshun', 'yisesanjiegao'],
  },
  {
    name: '推倒胡·小三元=31（叠加混一色，排除碰碰胡）', ruleset: 'tuidaohu', hand13: '555z666z7z456m789m', winTile: 'z7',
    expectTotal: 31, contains: ['xiaosanyuan', 'hunyise'], notContains: ['dasanyuan', 'duiduihu'],
  },
  {
    name: '不构成胡形', ruleset: 'tuidaohu', hand13: '123m456m789m1p9p5s9s', winTile: 'p1',
    cannotWin: 'no-shape',
  },
];

describe.each(CASES)('$name', (c) => {
  it('番数与番种符合预期', () => {
    const melded = c.melded ?? [];
    const ctx: WinContext = {
      ruleset: getRuleset(c.ruleset),
      melded,
      selfDraw: c.selfDraw ?? false,
      menqing: melded.every((m) => m.type === 'anGang'),
      flags: c.flags ?? {},
    };
    const r = evaluateWin(win(c.hand13, c.winTile), ctx);
    if (c.cannotWin) {
      expect('cannotWin' in r && r.reason).toBe(c.cannotWin);
      return;
    }
    if ('cannotWin' in r) throw new Error(`意外不可胡: ${r.reason}`);
    if (c.expectTotal !== undefined) expect(r.total).toBe(c.expectTotal);
    if (c.expectCapped !== undefined) expect(r.capped).toBe(c.expectCapped);
    const ids = r.matched.map((m) => m.yakuId);
    for (const id of c.contains ?? []) expect(ids).toContain(id);
    if (c.containsAny?.length) expect(c.containsAny.some((id) => ids.includes(id))).toBe(true);
    for (const id of c.notContains ?? []) expect(ids).not.toContain(id);
  });
});
