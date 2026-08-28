// 对局纯数据类型（领域层）。快照/视图的具体组装由应用层负责。
import type { MeldRef } from './agari';
import type { TileId } from './tiles';

export type GameAction =
  | { type: 'discard'; tile: TileId }
  | { type: 'chi'; tiles: [TileId, TileId]; from: number } // tiles = 从手中打出的两张搭子
  | { type: 'peng'; from: number }
  | { type: 'mingGang'; from: number } // 宣称别人打出的牌开明杠
  | { type: 'buGang'; tile: TileId } // 已碰的第四张补杠
  | { type: 'anGang'; tile: TileId }
  | { type: 'win'; selfDraw: boolean; tile?: TileId }
  | { type: 'pass' };

export type GamePhase = 'dealing' | 'action' | 'claims' | 'over';

export interface LastDiscard {
  tile: TileId;
  from: number;
}

/** 玩家可见局面：hand 含刚摸的张（行动阶段 3n+2 张） */
export interface PlayerView {
  seat: number;
  turn: number;
  phase: GamePhase;
  hand: TileId[];
  melds: MeldRef[][]; // 按座位
  discards: TileId[][]; // 按座位
  /** 34 向量：对该玩家可见的全部牌（四家弃牌+全部副露+自己手牌），用于剩余张数计算 */
  seenCounts: number[];
  wallCount: number;
  dealer: number;
  drawnTile?: TileId;
  lastDiscard?: LastDiscard;
  rulesetId: string;
}
