// 内存实现：隐私模式降级方案 + 单元测试替身（设计文档·错误处理「降级」项）。
import type {
  GameMeta,
  Mistake,
  QuizProgress,
  Repository,
  Settings,
  SnapshotEntry,
} from './repository';

interface Dump {
  v: 1;
  settings: Settings | null;
  games: GameMeta[];
  snapshots: Record<string, SnapshotEntry[]>;
  quiz: Record<string, QuizProgress>;
  mistakes: Mistake[];
}

export class MemoryRepository implements Repository {
  private settings: Settings | null = null;
  private games = new Map<string, GameMeta>();
  private snapshots = new Map<string, SnapshotEntry[]>();
  private quiz = new Map<string, QuizProgress>();
  private mistakes = new Map<string, Mistake>();

  async getSettings(): Promise<Settings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async saveSettings(s: Settings): Promise<void> {
    this.settings = { ...s };
  }

  async createGame(meta: GameMeta): Promise<void> {
    if (this.games.has(meta.id)) throw new Error(`对局已存在: ${meta.id}`);
    this.games.set(meta.id, { ...meta });
  }

  async finishGame(id: string, outcome: GameMeta['outcome']): Promise<void> {
    const g = this.games.get(id);
    if (!g) throw new Error(`对局不存在: ${id}`);
    g.outcome = outcome;
    g.finishedAt = Date.now();
  }

  async listGames(limit?: number): Promise<GameMeta[]> {
    const all = [...this.games.values()].sort((a, b) => b.startedAt - a.startedAt);
    return (limit ? all.slice(0, limit) : all).map((g) => ({ ...g }));
  }

  async appendSnapshot(gameId: string, seq: number, snapshotJson: string): Promise<void> {
    const list = this.snapshots.get(gameId) ?? [];
    if (list.some((e) => e.seq === seq)) throw new Error(`快照 seq 重复: ${gameId}#${seq}`);
    list.push({ seq, json: snapshotJson });
    list.sort((a, b) => a.seq - b.seq);
    this.snapshots.set(gameId, list);
  }

  async loadSnapshots(gameId: string): Promise<SnapshotEntry[]> {
    return (this.snapshots.get(gameId) ?? []).map((e) => ({ ...e }));
  }

  async getQuizProgress(chapterId: string): Promise<QuizProgress | null> {
    const p = this.quiz.get(chapterId);
    return p ? { ...p, doneQuestionIds: [...p.doneQuestionIds], correctIds: [...p.correctIds] } : null;
  }

  async saveQuizProgress(p: QuizProgress): Promise<void> {
    this.quiz.set(p.chapterId, { ...p, doneQuestionIds: [...p.doneQuestionIds], correctIds: [...p.correctIds] });
  }

  async addMistake(m: Mistake): Promise<void> {
    this.mistakes.set(m.id, { ...m });
  }

  async listMistakes(): Promise<Mistake[]> {
    return [...this.mistakes.values()].sort((a, b) => a.at - b.at).map((m) => ({ ...m }));
  }

  async removeMistake(id: string): Promise<void> {
    this.mistakes.delete(id);
  }

  async exportAll(): Promise<string> {
    const dump: Dump = {
      v: 1,
      settings: this.settings,
      games: [...this.games.values()],
      snapshots: Object.fromEntries(this.snapshots),
      quiz: Object.fromEntries(this.quiz),
      mistakes: [...this.mistakes.values()],
    };
    return JSON.stringify(dump);
  }

  async importAll(json: string, mode: 'merge' | 'replace'): Promise<void> {
    let dump: Dump;
    try {
      dump = JSON.parse(json) as Dump;
    } catch {
      throw new Error('备份文件不是合法 JSON');
    }
    if (dump.v !== 1 || !Array.isArray(dump.games)) throw new Error('备份版本不支持');
    if (mode === 'replace') {
      this.games.clear();
      this.snapshots.clear();
      this.quiz.clear();
      this.mistakes.clear();
      this.settings = null;
    }
    if (dump.settings) this.settings = { ...dump.settings };
    for (const g of dump.games) this.games.set(g.id, { ...g });
    for (const [k, v] of Object.entries(dump.snapshots ?? {})) {
      const list = (mode === 'merge' ? this.snapshots.get(k) : undefined) ?? [];
      for (const e of v) if (!list.some((x) => x.seq === e.seq)) list.push(e);
      list.sort((a, b) => a.seq - b.seq);
      this.snapshots.set(k, list);
    }
    for (const [k, v] of Object.entries(dump.quiz ?? {})) this.quiz.set(k, { ...v });
    for (const m of dump.mistakes ?? []) this.mistakes.set(m.id, { ...m });
  }
}
