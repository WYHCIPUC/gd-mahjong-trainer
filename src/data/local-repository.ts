// IndexedDB 实现（idb）。特性：
//  - 打开失败（隐私模式等）降级 MemoryRepository，persistent=false 供 UI 提示「本次进度不保存」；
//  - finishGame 后环形缓冲：只保留最近 KEEP_GAMES 局已完成对局（进行中对局不删，崩溃恢复优先）。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  MemoryRepository,
} from './memory-repository';
import type {
  GameMeta,
  Mistake,
  QuizProgress,
  Repository,
  Settings,
  SnapshotEntry,
} from './repository';

export const KEEP_GAMES = 200;

interface MahjongDB extends DBSchema {
  settings: { key: string; value: Settings };
  games: { key: string; value: GameMeta & { id: string } };
  snapshots: {
    key: [string, number];
    value: SnapshotEntry & { gameId: string };
    indexes: { 'by-game': string };
  };
  quiz: { key: string; value: QuizProgress };
  mistakes: { key: string; value: Mistake };
}

export interface RepositoryWithPersistence extends Repository {
  persistent: boolean;
}

const DB_NAME = 'gd-mahjong-trainer';
const DB_VERSION = 1;

export async function createLocalRepository(dbName = DB_NAME): Promise<RepositoryWithPersistence> {
  let db: IDBPDatabase<MahjongDB>;
  try {
    db = await openDB<MahjongDB>(dbName, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore('settings');
        d.createObjectStore('games', { keyPath: 'id' });
        const snaps = d.createObjectStore('snapshots', { keyPath: ['gameId', 'seq'] });
        snaps.createIndex('by-game', 'gameId');
        d.createObjectStore('quiz', { keyPath: 'chapterId' });
        d.createObjectStore('mistakes', { keyPath: 'id' });
      },
    });
  } catch {
    // 隐私模式等 IndexedDB 不可用场景：降级内存存储，功能不拦截
    const fallback = new MemoryRepository();
    return Object.assign(fallback, { persistent: false });
  }

  const repo: RepositoryWithPersistence = {
    persistent: true,
    async getSettings(): Promise<Settings | null> {
      return (await db.get('settings', 'app')) ?? null;
    },
    async saveSettings(s: Settings): Promise<void> {
      await db.put('settings', s, 'app');
    },
    async createGame(meta: GameMeta): Promise<void> {
      await db.put('games', { ...meta });
    },
    async finishGame(id: string, outcome: GameMeta['outcome']): Promise<void> {
      const g = await db.get('games', id);
      if (!g) throw new Error(`对局不存在: ${id}`);
      g.outcome = outcome;
      g.finishedAt = Date.now();
      await db.put('games', g);
      await trimOldGames();
    },
    async listGames(limit?: number): Promise<GameMeta[]> {
      const all = await db.getAll('games');
      all.sort((a, b) => b.startedAt - a.startedAt);
      return (limit ? all.slice(0, limit) : all).map((g) => ({ ...g }));
    },
    async appendSnapshot(gameId: string, seq: number, snapshotJson: string): Promise<void> {
      const existing = await db.get('snapshots', [gameId, seq]);
      if (existing) throw new Error(`快照 seq 重复: ${gameId}#${seq}`);
      await db.put('snapshots', { gameId, seq, json: snapshotJson });
    },
    async loadSnapshots(gameId: string): Promise<SnapshotEntry[]> {
      const rows = await db.getAllFromIndex('snapshots', 'by-game', gameId);
      return rows.map((r) => ({ seq: r.seq, json: r.json })).sort((a, b) => a.seq - b.seq);
    },
    async getQuizProgress(chapterId: string): Promise<QuizProgress | null> {
      return (await db.get('quiz', chapterId)) ?? null;
    },
    async saveQuizProgress(p: QuizProgress): Promise<void> {
      await db.put('quiz', p);
    },
    async addMistake(m: Mistake): Promise<void> {
      await db.put('mistakes', m);
    },
    async listMistakes(): Promise<Mistake[]> {
      const all = await db.getAll('mistakes');
      return all.sort((a, b) => a.at - b.at);
    },
    async removeMistake(id: string): Promise<void> {
      await db.delete('mistakes', id);
    },
    async exportAll(): Promise<string> {
      const dump = {
        v: 1,
        settings: await this.getSettings(),
        games: await db.getAll('games'),
        snapshots: await db.getAll('snapshots'),
        quiz: await db.getAll('quiz'),
        mistakes: await db.getAll('mistakes'),
      };
      return JSON.stringify(dump);
    },
    async importAll(json: string, mode: 'merge' | 'replace'): Promise<void> {
      let dump: {
        v?: number;
        settings?: Settings;
        games?: GameMeta[];
        snapshots?: (SnapshotEntry & { gameId: string })[];
        quiz?: QuizProgress[];
        mistakes?: Mistake[];
      };
      try {
        dump = JSON.parse(json);
      } catch {
        throw new Error('备份文件不是合法 JSON');
      }
      if (dump.v !== 1 || !Array.isArray(dump.games)) throw new Error('备份版本不支持');
      const tx = db.transaction(['settings', 'games', 'snapshots', 'quiz', 'mistakes'], 'readwrite');
      if (mode === 'replace') {
        await tx.objectStore('games').clear();
        await tx.objectStore('snapshots').clear();
        await tx.objectStore('quiz').clear();
        await tx.objectStore('mistakes').clear();
        await tx.objectStore('settings').clear();
      }
      if (dump.settings) await tx.objectStore('settings').put(dump.settings, 'app');
      for (const g of dump.games) await tx.objectStore('games').put(g);
      for (const s of dump.snapshots ?? []) await tx.objectStore('snapshots').put(s);
      for (const q of dump.quiz ?? []) await tx.objectStore('quiz').put(q);
      for (const m of dump.mistakes ?? []) await tx.objectStore('mistakes').put(m);
      await tx.done;
    },
  };
  return repo;

  /** 环形缓冲：已完成对局超过 KEEP_GAMES 时删最旧（连同其快照） */
  async function trimOldGames(): Promise<void> {
    const all = await db.getAll('games');
    const finished = all.filter((g) => g.outcome !== 'ongoing').sort((a, b) => a.startedAt - b.startedAt);
    const excess = finished.length - KEEP_GAMES;
    if (excess <= 0) return;
    const tx = db.transaction(['games', 'snapshots'], 'readwrite');
    for (const g of finished.slice(0, excess)) {
      void tx.objectStore('games').delete(g.id);
      void tx.objectStore('snapshots').delete(IDBKeyRange.bound([g.id, 0], [g.id, Infinity]));
    }
    await tx.done;
  }
}
