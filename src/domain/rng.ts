// 可播种 RNG（mulberry32）：一切牌墙洗牌都经此，保证对局可复现（回放/测试/教练校准）。
export const WALL_SIZE = 136;

export interface WallTile {
  tileIndex: number; // 0-33 牌种
  copy: number; // 0-3 区分同种的不同实体
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWall(rng: () => number): WallTile[] {
  const deck: WallTile[] = [];
  for (let i = 0; i < 34; i++) {
    for (let c = 0; c < 4; c++) deck.push({ tileIndex: i, copy: c });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
