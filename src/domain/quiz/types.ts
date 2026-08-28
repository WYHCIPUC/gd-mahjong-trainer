// 学习中心题型与判分（设计文档·学习中心）：选 best 判对；选 acceptable 判对并标注「两者皆可」；
// 其余判错入错题本。判分规则与静态题、随机练习共用。
import type { TileId } from '../tiles';

export type QuizChapter = 'efficiency' | 'safety' | 'yaku' | 'claim';

export interface QuizQuestion {
  id: string;
  chapter: QuizChapter;
  type: 'choose-discard' | 'fan-reading';
  /** 简写手牌串（13 张暗牌） */
  hand: string;
  seen?: string;
  options: TileId[];
  best: TileId;
  /** 容差内的次优答案（进张差 < 2 判「两者皆可」） */
  acceptable?: TileId[];
  explanation: string;
}

export type Grade = 'best' | 'acceptable' | 'wrong';

export function gradeAnswer(q: QuizQuestion, choice: TileId): Grade {
  if (choice === q.best) return 'best';
  if (q.acceptable?.includes(choice)) return 'acceptable';
  return 'wrong';
}
