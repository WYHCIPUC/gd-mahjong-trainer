import { describe, it, expect } from 'vitest';
import {
  newGame,
  applyAction,
  playerView,
  assertTileConservation,
  autoStep,
  serializeSnapshot,
  deserializeSnapshot,
  MahjongError,
  type GameState,
} from '../../src/app/game-controller';
import { decide } from '../../src/domain/ai/decider';
import { getRuleset } from '../../src/domain/rulesets';
import { tileIdToIndex, type TileId } from '../../src/domain/tiles';
import type { Difficulty } from '../../src/domain/ai/types';

const DIFFS: Difficulty[] = ['expert', 'intermediate', 'novice', 'intermediate'];
const playAll = (state: GameState): GameState => {
  let s = state;
  let guard = 0;
  while (!s.result) {
    if (++guard > 3000) throw new Error('对局未终止');
    s = autoStep(s, (view) => decide(view, DIFFS[view.seat], getRuleset(view.rulesetId)));
    assertTileConservation(s);
  }
  return s;
};

/** 把某座位手中的 n 张任意牌替换成指定牌种（保持总张数，便于构造测试局面） */
const swapInto = (s: GameState, seat: number, tile: TileId, n: number): void => {
  const t = tileIdToIndex(tile);
  let replaced = 0;
  for (let i = 0; i < 34 && replaced < n; i++) {
    while (s.hands[seat][i] > 0 && replaced < n) {
      s.hands[seat][i]--;
      s.hands[seat][t]++;
      replaced++;
    }
  }
  if (replaced < n) throw new Error(`替换不足：需要 ${n}，完成 ${replaced}`);
};

describe('newGame 发牌', () => {
  it('庄家 14 张、闲家 13 张、牌墙 83 张、守恒成立', () => {
    const s = newGame({ seed: 42, rulesetId: 'tuidaohu', dealer: 2 });
    expect(s.hands[2].reduce((a, b) => a + b, 0)).toBe(14);
    for (const seat of [0, 1, 3]) expect(s.hands[seat].reduce((a, b) => a + b, 0)).toBe(13);
    expect(s.wall.length).toBe(83);
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('action');
    expect(() => assertTileConservation(s)).not.toThrow();
  });

  it('同 seed 完全一致（可复现）', () => {
    expect(newGame({ seed: 7, rulesetId: 'gangshi' })).toEqual(newGame({ seed: 7, rulesetId: 'gangshi' }));
  });
});

describe('行动与宣称', () => {
  it('打出后进入宣称阶段，全部通过则下家摸牌', () => {
    let s = newGame({ seed: 11, rulesetId: 'tuidaohu' });
    const tile = playerView(s, 0).hand[0];
    s = applyAction(s, { type: 'discard', tile });
    expect(s.phase).toBe('claims');
    expect(s.lastDiscard).toEqual({ tile, from: 0 });
    s = applyAction(s, { type: 'pass' });
    expect(s.phase).toBe('action');
    expect(s.turn).toBe(1);
    expect(s.hands[1].reduce((a, b) => a + b, 0)).toBe(14);
  });

  it('打出手中没有的牌被拒绝', () => {
    const s = newGame({ seed: 3, rulesetId: 'tuidaohu' });
    const inHand = new Set(playerView(s, 0).hand);
    const missing = (['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'] as const).find((t) => !inHand.has(t));
    expect(() => applyAction(s, { type: 'discard', tile: missing ?? 'm1' })).toThrow(MahjongError);
  });

  it('碰：从弃牌池碰成副露，碰者补位出牌且守恒', () => {
    let s = newGame({ seed: 5, rulesetId: 'tuidaohu', dealer: 2 });
    const t = 'z5';
    swapInto(s, 1, t, 2); // 座位 1 手中凑两张 z5
    swapInto(s, 2, t, 1); // 庄家（座位 2）手中凑一张 z5（用于打出）
    s = applyAction(s, { type: 'discard', tile: t }, 2);
    expect(() => assertTileConservation(s)).not.toThrow();
    s = applyAction(s, { type: 'peng', from: 2 }, 1);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('action');
    expect(s.melds[1]).toEqual([{ type: 'peng', tiles: [t, t, t] }]);
    expect(s.hands[1].reduce((a, b) => a + b, 0)).toBe(11); // 3n+2，待出牌
    expect(() => assertTileConservation(s)).not.toThrow();
  });
});

describe('结算', () => {
  it('庄家起手自摸=天胡：26 番（鸡胡+门清+自摸+天胡），三家各付', () => {
    let s = newGame({ seed: 9, rulesetId: 'tuidaohu', dealer: 0 });
    s.hands[0] = new Array<number>(34).fill(0);
    for (const t of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'p3', 's1', 's1'] as const) {
      s.hands[0][tileIdToIndex(t)]++;
    }
    s = applyAction(s, { type: 'win', selfDraw: true });
    expect(s.result?.type).toBe('win');
    expect(s.result?.winner).toBe(0);
    expect(s.result?.fan?.total).toBe(26); // 鸡胡 0 + 门清 1 + 自摸 1 + 天胡 24
    expect(s.result?.deltas).toEqual([78, -26, -26, -26]);
  });

  it('点炮胡：点炮者独付', () => {
    let s = newGame({ seed: 13, rulesetId: 'tuidaohu', dealer: 0 });
    // 座位 1：345m 678m 123p 222s + z5，听 z5 对倒?? 单钓成对
    s.hands[1] = new Array<number>(34).fill(0);
    for (const t of ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'p1', 'p2', 'p3', 's2', 's2', 's2', 'z5'] as const) {
      s.hands[1][tileIdToIndex(t)]++;
    }
    // 庄家塞一张 z5，同时从牌墙划走一张（保持守恒）
    s.hands[0][tileIdToIndex('z5')]++;
    s.wall.pop();
    expect(() => assertTileConservation(s)).not.toThrow();
    s = applyAction(s, { type: 'discard', tile: 'z5' }, 0);
    s = applyAction(s, { type: 'win', selfDraw: false, tile: 'z5' }, 1);
    expect(s.result?.type).toBe('win');
    expect(s.result?.winner).toBe(1);
    expect(s.result?.winTile).toBe('z5');
    // 鸡胡 0 + 门清 1 = 1 番：胡家 +1、点炮者（庄家座位 0）-1
    expect(s.result?.deltas).toEqual([-1, 1, 0, 0]);
  });

  it('牌墙摸空流局', () => {
    let s = newGame({ seed: 15, rulesetId: 'tuidaohu' });
    s.wall.length = 0; // 测试捷径：清空牌墙
    s = applyAction(s, { type: 'discard', tile: playerView(s, 0).hand[0] }, 0);
    s = applyAction(s, { type: 'pass' });
    expect(s.result?.type).toBe('draw');
    expect(s.phase).toBe('over');
  });
});

describe('快照序列化', () => {
  it('序列化往返一致', () => {
    const s = newGame({ seed: 21, rulesetId: 'jipinghu' });
    expect(deserializeSnapshot(serializeSnapshot(s))).toEqual(s);
  });

  it('拒绝未知版本', () => {
    expect(() => deserializeSnapshot('{"v":99,"state":{}}')).toThrow(MahjongError);
  });
});

describe('整局自动行棋', () => {
  it('固定 seed 完整打完一局并正确终局', () => {
    const s = playAll(newGame({ seed: 1, rulesetId: 'tuidaohu' }));
    expect(s.result).not.toBeNull();
    expect(s.phase).toBe('over');
    if (s.result?.type === 'win') {
      expect(s.result.fan).not.toBeNull();
      expect(s.result.deltas.reduce((a, b) => a + b, 0)).toBe(0);
    }
  }, 120_000);
});
