// Ruleset：流派差异全部走数据（设计决策 #4）。番种表内容为 [experimental]，
// 以 Task 11 对照公开资料核对修正为准；接口承诺只增不改。
export interface YakuDef {
  id: string;
  name: string;
  fan: number;
  /** 判定谓词 id，见 domain/yaku.ts 的注册表 */
  when: string;
  /** 本番种成立时不与列表内番种叠加（被排除者直接丢弃） */
  excludes?: string[];
  /** 同组番种只取番数最高者（如 qingyise/hunyise 同组 yise） */
  group?: string;
  /** 保底番：任何胡形都成立（鸡胡/平胡） */
  base?: boolean;
}

export type SpecialFlags = {
  gangKai: boolean;
  qiangGang: boolean;
  haiDi: boolean;
  tianHu: boolean;
  diHu: boolean;
};

export interface Ruleset {
  id: string;
  name: string;
  experimental: true;
  allowsChi: boolean;
  /** 起胡番数，0 = 鸡胡可胡 */
  startingFan: number;
  /** 封顶番数；null = 不封顶 */
  capFan: number | null;
  forms: { standard: boolean; chiitoi: boolean; kokushi: boolean };
  /** v1 固定结算方向：自摸三家各付 / 点炮者独付 */
  scoring: { selfDraw: 'three-pay'; discard: 'discarder-pays' };
  special: SpecialFlags;
  yaku: YakuDef[];
}
