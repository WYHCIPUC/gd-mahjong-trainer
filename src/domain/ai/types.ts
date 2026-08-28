// AI 决策器共享类型。DecisionReason 的结构为 [internal]，可随教学话术迭代。
import type { GameAction } from '../game-types';

export type Difficulty = 'novice' | 'intermediate' | 'expert';

export interface DecisionReason {
  kind: 'efficiency' | 'danger' | 'fan' | 'claim';
  text: string;
  data?: Record<string, number | string>;
}

export interface Decision {
  action: GameAction;
  score: number;
  confidence: number; // 0-1，与次优的相对优势
  reasons: DecisionReason[];
}
