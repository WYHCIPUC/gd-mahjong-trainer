import { describe, it, expect } from 'vitest';
import { shantenOf, listWaits, legalActions, canWin } from '../../src/domain/engine';
import { getRuleset } from '../../src/domain/rulesets';
import type { PlayerView } from '../../src/domain/game-types';
import { parseHandShorthand, tileIdToIndex, type TileId } from '../../src/domain/tiles';

const withTile = (hand13: string, tile: TileId): number[] => {
  const counts = parseHandShorthand(hand13);
  counts[tileIdToIndex(tile)]++;
  return counts;
};

describe('engine.shantenOf（按 ruleset 门控胡牌形）', () => {
  it('十三幺：港式计入，推倒胡不计入', () => {
    const hand = parseHandShorthand('19m19p19s1234567z');
    expect(shantenOf(hand, 0, getRuleset('gangshi'))).toBe(0);
    expect(shantenOf(hand, 0, getRuleset('tuidaohu'))).toBeGreaterThan(0);
  });
  it('七对：有碰杠后不再计入（只剩标准形）', () => {
    const hand = parseHandShorthand('11m22m33p44p55s'); // 七对 1 向听；标准形（无可组合搭子）更差
    expect(shantenOf(hand, 0, getRuleset('tuidaohu'))).toBe(1); // 取七对
    expect(shantenOf(hand, 1, getRuleset('tuidaohu'))).toBeGreaterThan(1); // 碰杠后七对不可用
  });
});

describe('engine.listWaits（听牌与剩余张数）', () => {
  it('听牌枚举与扣除已见（seen 含自己手牌）', () => {
    const hand = parseHandShorthand('123m456m789m12p55p'); // 唯一听牌 3p（12p 需 3p 成顺，55p 作雀头）
    const seen = hand.slice();
    seen[tileIdToIndex('p3')]++;
    const waits = listWaits(hand, 0, seen, getRuleset('tuidaohu'));
    expect(waits.length).toBe(1);
    expect(waits[0].tile).toBe('p3');
    expect(waits[0].remaining).toBe(3); // 4 - 已见 1
  });
  it('四张全见不再列为听牌', () => {
    const hand = parseHandShorthand('123m456m789m12p55p');
    const seen = hand.slice();
    seen[tileIdToIndex('p3')] = 4;
    const waits = listWaits(hand, 0, seen, getRuleset('tuidaohu'));
    expect(waits.find((w) => w.tile === 'p3')).toBeUndefined();
  });
});

describe('engine.legalActions', () => {
  const base = {
    seat: 1,
    turn: 0,
    melds: [[], [], [], []] as PlayerView['melds'],
    discards: [[], [], [], []] as PlayerView['discards'],
    seenCounts: new Array(34).fill(0),
    wallCount: 50,
    dealer: 0,
    rulesetId: 'tuidaohu',
  };

  it('行动阶段：打牌枚举唯一张 + 四张可暗杠', () => {
    const hand = ['z1', 'z1', 'z1', 'z1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'p8', 'p8', 'p9', 'p9'];
    const view: PlayerView = { ...base, phase: 'action', hand, turn: 1 };
    const acts = legalActions(view, getRuleset('tuidaohu'));
    const discards = acts.filter((a) => a.type === 'discard');
    expect(discards.length).toBe(new Set(hand).size);
    expect(acts).toContainEqual({ type: 'anGang', tile: 'z1' });
    expect(acts.some((a) => a.type === 'win')).toBe(false);
  });

  it('宣称阶段（推倒胡）：弃牌成对可胡', () => {
    // 弃 z5 → 55z 雀头 + 345m 678m 111p 222s
    const hand = ['z5', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'p1', 'p1', 'p1', 's2', 's2', 's2'];
    const view: PlayerView = { ...base, phase: 'claims', hand, turn: 0, lastDiscard: { tile: 'z5', from: 0 } };
    const acts = legalActions(view, getRuleset('tuidaohu'));
    expect(acts.some((a) => a.type === 'win')).toBe(true);
    expect(acts.some((a) => a.type === 'peng')).toBe(false); // 手中仅一张 z5
  });

  it('宣称阶段：三张在手可碰可明杠', () => {
    const hand = ['z5', 'z5', 'z5', 'm3', 'm4', 'm5', 'm6', 'm7', 'p1', 'p1', 's2', 's2', 's2'];
    const view: PlayerView = { ...base, phase: 'claims', hand, turn: 0, lastDiscard: { tile: 'z5', from: 0 } };
    const acts = legalActions(view, getRuleset('tuidaohu'));
    expect(acts).toContainEqual({ type: 'peng', from: 0 });
    expect(acts).toContainEqual({ type: 'mingGang', from: 0 });
  });

  it('宣称阶段：下家可吃且枚举吃法（港式不可吃）', () => {
    const hand = ['m2', 'm3', 'm5', 'm6', 'm7', 'p1', 'p1', 'p1', 's2', 's2', 's2', 's3', 's4'];
    const view: PlayerView = { ...base, phase: 'claims', hand, turn: 0, lastDiscard: { tile: 'm4', from: 0 } };
    const actsTd = legalActions(view, getRuleset('tuidaohu'));
    const chis = actsTd.filter((a) => a.type === 'chi') as Extract<(typeof actsTd)[number], { type: 'chi' }>[];
    expect(chis.map((c) => c.tiles.sort().join('')).sort()).toEqual(['m2m3', 'm3m5', 'm5m6'].sort());
    const actsGs = legalActions(view, getRuleset('gangshi'));
    expect(actsGs.some((a) => a.type === 'chi')).toBe(false);
  });
});

describe('engine.canWin', () => {
  it('港式十三幺可胡，推倒胡不可', () => {
    const counts = withTile('19m19p19s1234567z', 'z7');
    const ctx = (id: 'gangshi' | 'tuidaohu') => ({
      ruleset: getRuleset(id),
      melded: [],
      selfDraw: false,
      menqing: true,
      flags: {},
    });
    expect(canWin(counts, ctx('gangshi'))).not.toBeNull();
    expect(canWin(counts, ctx('tuidaohu'))).toBeNull();
  });
});
