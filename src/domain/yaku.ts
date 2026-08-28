// 番种判定谓词注册表。Task 7 先登记合法谓词 id（ruleset JSON 校验用），
// Task 9 填充各谓词实现：Record<string, (decomp, ctx) => boolean>。
export const PREDICATE_IDS = [
  'base', // 任何胡形
  'zimo', // 自摸
  'menqing', // 门前清（无任何碰杠）
  'duiduihu', // 碰碰胡
  'hunyise', // 混一色
  'qingyise', // 清一色
  'chiitoi', // 七对
  'hunlaotou', // 混老头
  'qinglaotou', // 清老头
  'ziyise', // 字一色
  'dasixi', // 大四喜
  'xiaosixi', // 小四喜
  'dasanyuan', // 大三元
  'xiaosanyuan', // 小三元
  'gangkai', // 杠上开花
  'qianggang', // 抢杠胡
  'haidi', // 海底捞月
  'tianhu', // 天胡
  'dihu', // 地胡
  'shisanyao', // 十三幺
  'kankahu', // 坎坎胡（四暗刻）
  'yisesantongshun', // 一色三同顺
  'yisesanjiegao', // 一色三节高
] as const;

export type PredicateId = (typeof PREDICATE_IDS)[number];
