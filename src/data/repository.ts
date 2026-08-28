// 数据层 Repository 接口 [public]：承诺「CRUD + exportAll/importAll」只增不改签名。
// 领域/UI 禁止绕过此接口读写存储（设计文档·分层纪律）。
import type { Difficulty } from '../domain/ai/types';

export interface Settings {
  rulesetId: string;
  difficulty: Difficulty;
  hintEnabled: boolean;
  gamesUntilBackupHint: number;
}

export interface GameMeta {
  id: string;
  rulesetId: string;
  startedAt: number;
  finishedAt: number | null;
  outcome: 'ongoing' | 'win' | 'loss' | 'draw';
}

export interface QuizProgress {
  chapterId: string;
  doneQuestionIds: string[];
  correctIds: string[];
}

export interface Mistake {
  id: string;
  questionId: string;
  chapterId: string;
  wrongAnswer: string;
  at: number;
}

export interface SnapshotEntry {
  seq: number;
  json: string;
}

export interface Repository {
  // 设置
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;

  // 对局（快照 append-only）
  createGame(meta: GameMeta): Promise<void>;
  finishGame(id: string, outcome: GameMeta['outcome']): Promise<void>;
  listGames(limit?: number): Promise<GameMeta[]>;
  appendSnapshot(gameId: string, seq: number, snapshotJson: string): Promise<void>;
  loadSnapshots(gameId: string): Promise<SnapshotEntry[]>;

  // 练习进度与错题本
  getQuizProgress(chapterId: string): Promise<QuizProgress | null>;
  saveQuizProgress(p: QuizProgress): Promise<void>;
  addMistake(m: Mistake): Promise<void>;
  listMistakes(): Promise<Mistake[]>;
  removeMistake(id: string): Promise<void>;

  // 备份
  exportAll(): Promise<string>;
  importAll(json: string, mode: 'merge' | 'replace'): Promise<void>;
}
