// 应用层存储入口：UI 层只经此获取 Repository（不直接触碰 idb/local-repository）。
import { createLocalRepository, type RepositoryWithPersistence } from '../data/local-repository';

let cached: Promise<RepositoryWithPersistence> | null = null;

export function getRepository(): Promise<RepositoryWithPersistence> {
  if (!cached) cached = createLocalRepository();
  return cached;
}
