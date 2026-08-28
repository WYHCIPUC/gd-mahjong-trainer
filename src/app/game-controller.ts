// 对局控制器：纯 reducer 状态机（不可变快照，append-only 支撑复盘与崩溃恢复）。
// 摸 → 打 → 碰/杠/胡宣称 → 结算；一切合法性经规则引擎校验。
import { buildWall, mulberry32 } from '../domain/rng';
import { evaluateWin, type FanResult } from '../domain/score';
import type { WinContext } from '../domain/yaku';
import { getRuleset } from '../domain/rulesets';
import type { GameAction, GamePhase, LastDiscard, PlayerView } from '../domain/game-types';
import type { MeldRef } from '../domain/agari';
import { indexToTileId, tileIdToIndex, type TileId } from '../domain/tiles';
import type { Decision } from '../domain/ai/types';

export interface GameConfig {
  seed: number;
  rulesetId: string;
  dealer?: number;
}

export interface GameFlags {
  gangKai?: boolean;
  qiangGang?: boolean;
  haiDi?: boolean;
  tianHu?: boolean;
  diHu?: boolean;
}

export interface GameResult {
  type: 'win' | 'draw';
  winner: number | null;
  winTile: TileId | null;
  selfDraw: boolean;
  fan: FanResult | null;
  /** 四家分数变动（点数，v1 简化：自摸三家各付、点炮者独付） */
  deltas: number[];
}

/** v:1 快照格式，只增不改（设计文档接口契约） */
export interface GameState {
  v: 1;
  seed: number;
  rulesetId: string;
  dealer: number;
  turn: number;
  phase: GamePhase;
  /** 暗牌 34 维计数；行动阶段 hands[turn] 已含刚摸的张（3n+2） */
  hands: number[][];
  melds: MeldRef[][];
  discards: TileId[][];
  /** 剩余牌墙（牌种索引序列，尾部摸牌） */
  wall: number[];
  /** 展示用：刚摸到的牌（计数已含在 hands 中） */
  drawnTile: TileId | null;
  lastDiscard: LastDiscard | null;
  flags: GameFlags;
  result: GameResult | null;
  discardCount: number;
  drawCount: number;
  snapshotSeq: number;
}

export class MahjongError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

const meldTileCount = (m: MeldRef): number => (m.type === 'peng' || m.type === 'chi' ? 3 : 4);

export function newGame(cfg: GameConfig): GameState {
  const rng = mulberry32(cfg.seed);
  const wall = buildWall(rng).map((t) => t.tileIndex);
  const hands = [0, 1, 2, 3].map(() => new Array<number>(34).fill(0));
  const dealer = cfg.dealer ?? 0;
  for (let seat = 0; seat < 4; seat++) {
    const n = seat === dealer ? 14 : 13;
    for (let i = 0; i < n; i++) hands[seat][wall.pop()!]++;
  }
  return {
    v: 1,
    seed: cfg.seed,
    rulesetId: cfg.rulesetId,
    dealer,
    turn: dealer,
    phase: 'action',
    hands,
    melds: [[], [], [], []],
    discards: [[], [], [], []],
    wall,
    drawnTile: null,
    lastDiscard: null,
    flags: {},
    result: null,
    discardCount: 0,
    drawCount: 14,
    snapshotSeq: 0,
  };
}

function drawTo(s: GameState, seat: number, afterGang: boolean): void {
  if (s.wall.length === 0) {
    s.result = { type: 'draw', winner: null, winTile: null, selfDraw: false, fan: null, deltas: [0, 0, 0, 0] };
    s.phase = 'over';
    s.drawnTile = null;
    return;
  }
  const t = s.wall.pop()!;
  s.hands[seat][t]++;
  s.drawCount++;
  s.drawnTile = indexToTileId(t);
  s.flags = { ...s.flags, gangKai: afterGang, haiDi: s.wall.length === 0 };
}

function settleWin(s: GameState, winner: number, fan: FanResult, selfDraw: boolean, winTile: TileId): void {
  const n = fan.total;
  const deltas = [0, 0, 0, 0];
  if (selfDraw) {
    for (let i = 0; i < 4; i++) deltas[i] = i === winner ? 3 * n : -n;
  } else {
    deltas[winner] = n;
    deltas[s.lastDiscard!.from] = -n;
  }
  s.result = { type: 'win', winner, winTile, selfDraw, fan, deltas };
  s.phase = 'over';
  s.lastDiscard = null;
  s.drawnTile = null;
}

function winContext(s: GameState, seat: number, selfDraw: boolean): WinContext {
  return {
    ruleset: getRuleset(s.rulesetId),
    melded: s.melds[seat],
    selfDraw,
    menqing: s.melds[seat].length === 0,
    flags: {
      ...s.flags,
      // 天胡：庄家起手暗牌即胡；地胡：闲家第一次摸牌即胡（v1 近似，discardCount===0）
      tianHu: selfDraw && seat === s.dealer && s.discardCount === 0,
      diHu: selfDraw && seat !== s.dealer && s.discardCount === 0,
    },
  };
}

/** claimant：宣称者座位（action 阶段固定为 turn，claims 阶段由驱动方传入） */
export function applyAction(state: GameState, action: GameAction, claimant = state.turn): GameState {
  if (state.result) throw new MahjongError('GAME_OVER', '对局已结束');
  const s = structuredClone(state);
  const ruleset = getRuleset(s.rulesetId);

  if (s.phase === 'action') {
    if (claimant !== s.turn) throw new MahjongError('NOT_YOUR_TURN', `轮到座位 ${s.turn}`);
    switch (action.type) {
      case 'discard': {
        const t = tileIdToIndex(action.tile);
        if (s.hands[s.turn][t] <= 0) throw new MahjongError('ILLEGAL_DISCARD', `手中无 ${action.tile}`);
        s.hands[s.turn][t]--;
        s.discards[s.turn].push(action.tile);
        s.lastDiscard = { tile: action.tile, from: s.turn };
        s.drawnTile = null;
        s.discardCount++;
        s.phase = 'claims';
        break;
      }
      case 'win': {
        const fan = evaluateWin(s.hands[s.turn], winContext(s, s.turn, true));
        if ('cannotWin' in fan) throw new MahjongError('ILLEGAL_WIN', '未构成胡形', fan.reason);
        settleWin(s, s.turn, fan, true, s.drawnTile ?? indexToTileId(s.hands[s.turn].findIndex((c) => c > 0)));
        break;
      }
      case 'anGang': {
        const t = tileIdToIndex(action.tile);
        if (s.hands[s.turn][t] !== 4) throw new MahjongError('ILLEGAL_KONG', `手中无四张 ${action.tile}`);
        s.hands[s.turn][t] = 0;
        s.melds[s.turn].push({ type: 'anGang', tiles: [action.tile, action.tile, action.tile, action.tile] });
        drawTo(s, s.turn, true);
        break;
      }
      case 'buGang': {
        const t = tileIdToIndex(action.tile);
        const meld = s.melds[s.turn].find((m) => m.type === 'peng' && tileIdToIndex(m.tiles[0]) === t);
        if (!meld || s.hands[s.turn][t] < 1) throw new MahjongError('ILLEGAL_KONG', `无可补杠的 ${action.tile}`);
        s.hands[s.turn][t]--;
        meld.type = 'buGang';
        meld.tiles.push(action.tile);
        drawTo(s, s.turn, true);
        break;
      }
      default:
        throw new MahjongError('WRONG_PHASE_ACTION', `行动阶段不支持 ${action.type}`);
    }
    s.snapshotSeq++;
    return s;
  }

  if (s.phase === 'claims' && s.lastDiscard) {
    const from = s.lastDiscard.from;
    const tile = s.lastDiscard.tile;
    const t = tileIdToIndex(tile);
    switch (action.type) {
      case 'pass': {
        s.turn = (from + 1) % 4;
        s.lastDiscard = null;
        s.phase = 'action';
        drawTo(s, s.turn, false);
        break;
      }
      case 'win': {
        const counts = s.hands[claimant].slice();
        counts[t]++;
        const fan = evaluateWin(counts, winContext(s, claimant, false));
        if ('cannotWin' in fan) throw new MahjongError('ILLEGAL_WIN', '未构成胡形', fan.reason);
        settleWin(s, claimant, fan, false, tile);
        break;
      }
      case 'peng': {
        if (s.hands[claimant][t] < 2) throw new MahjongError('ILLEGAL_CLAIM', `手中不足两张 ${tile}`);
        s.hands[claimant][t] -= 2;
        s.melds[claimant].push({ type: 'peng', tiles: [tile, tile, tile] });
        s.discards[from].pop();
        s.turn = claimant;
        s.lastDiscard = null;
        s.phase = 'action';
        s.drawnTile = null;
        break;
      }
      case 'mingGang': {
        if (s.hands[claimant][t] < 3) throw new MahjongError('ILLEGAL_CLAIM', `手中不足三张 ${tile}`);
        s.hands[claimant][t] -= 3;
        s.melds[claimant].push({ type: 'mingGang', tiles: [tile, tile, tile, tile] });
        s.discards[from].pop();
        s.turn = claimant;
        s.lastDiscard = null;
        s.phase = 'action';
        drawTo(s, claimant, true);
        break;
      }
      case 'chi': {
        if (!ruleset.allowsChi) throw new MahjongError('ILLEGAL_CLAIM', '当前流派不可吃牌');
        if (claimant !== (from + 1) % 4) throw new MahjongError('ILLEGAL_CLAIM', '只有下家可吃');
        const a = tileIdToIndex(action.tiles[0]);
        const b = tileIdToIndex(action.tiles[1]);
        if (s.hands[claimant][a] <= 0 || s.hands[claimant][b] <= 0) {
          throw new MahjongError('ILLEGAL_CLAIM', '吃牌搭子不在手中');
        }
        s.hands[claimant][a]--;
        s.hands[claimant][b]--;
        s.melds[claimant].push({ type: 'chi', tiles: [...action.tiles, tile].sort() });
        s.discards[from].pop();
        s.turn = claimant;
        s.lastDiscard = null;
        s.phase = 'action';
        s.drawnTile = null;
        break;
      }
      default:
        throw new MahjongError('WRONG_PHASE_ACTION', `宣称阶段不支持 ${action.type}`);
    }
    s.snapshotSeq++;
    return s;
  }

  throw new MahjongError('WRONG_PHASE', `阶段 ${s.phase} 不可行动`);
}

/** 某座位可见局面（其余暗牌不进入视图） */
export function playerView(state: GameState, seat: number): PlayerView {
  const handIds: TileId[] = [];
  state.hands[seat].forEach((c, i) => {
    for (let k = 0; k < c; k++) handIds.push(indexToTileId(i));
  });
  const seen = new Array<number>(34).fill(0);
  for (let i = 0; i < 4; i++) {
    for (const d of state.discards[i]) seen[tileIdToIndex(d)]++;
    for (const m of state.melds[i]) for (const t of m.tiles) seen[tileIdToIndex(t)]++;
  }
  for (let t = 0; t < 34; t++) seen[t] += state.hands[seat][t];
  return {
    seat,
    turn: state.turn,
    phase: state.phase,
    hand: handIds,
    melds: state.melds,
    discards: state.discards,
    seenCounts: seen,
    wallCount: state.wall.length,
    dealer: state.dealer,
    drawnTile: seat === state.turn ? state.drawnTile ?? undefined : undefined,
    lastDiscard: state.lastDiscard ?? undefined,
    rulesetId: state.rulesetId,
  };
}

/** 牌数守恒不变量：四家暗牌 + 副露 + 弃牌 + 牌墙 = 136（SC-3） */
export function assertTileConservation(state: GameState): void {
  let used = 0;
  for (let i = 0; i < 4; i++) {
    used += state.hands[i].reduce((a, b) => a + b, 0);
    used += state.melds[i].reduce((a, m) => a + meldTileCount(m), 0);
    used += state.discards[i].length;
  }
  used += state.wall.length;
  if (used !== 136) {
    throw new MahjongError('CONSERVATION', `牌数不守恒：${used} ≠ 136`, { seq: state.snapshotSeq });
  }
}

const CLAIM_PRIORITY: Partial<Record<GameAction['type'], number>> = { win: 3, mingGang: 2, peng: 2, chi: 1 };

/** 自动走一步：action 阶段问当前玩家，claims 阶段按 胡>杠碰>吃 优先级汇总各家意向 */
export function autoStep(state: GameState, decideFor: (view: PlayerView) => Decision): GameState {
  if (state.result) return state;
  if (state.phase === 'action') {
    const d = decideFor(playerView(state, state.turn));
    return applyAction(state, d.action);
  }
  if (state.phase === 'claims' && state.lastDiscard) {
    const from = state.lastDiscard.from;
    let best: { priority: number; seat: number; action: GameAction } | null = null;
    for (let seat = 0; seat < 4; seat++) {
      if (seat === from) continue;
      const d = decideFor(playerView(state, seat));
      const priority = CLAIM_PRIORITY[d.action.type] ?? 0;
      if (priority === 0) continue;
      if (!best || priority > best.priority) best = { priority, seat, action: d.action };
    }
    if (best) return applyAction(state, best.action, best.seat);
    return applyAction(state, { type: 'pass' });
  }
  throw new MahjongError(
    'WRONG_PHASE',
    `阶段 ${state.phase} 不可自动行走 lastDiscard=${JSON.stringify(state.lastDiscard)} result=${JSON.stringify(state.result)} seq=${state.snapshotSeq}`,
  );
}

export function serializeSnapshot(state: GameState): string {
  return JSON.stringify({ v: 1, state });
}

export function deserializeSnapshot(json: string): GameState {
  const parsed = JSON.parse(json) as { v?: number; state?: GameState };
  if (parsed.v !== 1 || !parsed.state) throw new MahjongError('BAD_SNAPSHOT', '快照版本不支持或格式错误');
  return parsed.state;
}
