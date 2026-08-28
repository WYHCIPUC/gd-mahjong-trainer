# 广东麻将训练

移动优先的纯前端 Web 应用：AI 陪练对局、听牌计算器、学习中心三合一，帮助系统性提高广东麻将水平。

- **零运行成本**：纯静态托管（GitHub Pages），无服务器、无 API、数据不出本机
- **可解释 AI**：确定性启发式决策器，每步出牌都给出理由；三档难度（新手/进阶/老手）
- **三流派**：推倒胡 / 鸡平胡 / 港式新章（ruleset 为纯数据，番种表见设置页全文）

## 开发

```bash
npm install          # 国内网络：追加 --registry=https://registry.npmmirror.com
npm run dev          # 开发服务器
npm test             # 快速单元套件（Vitest）
npm run test:sim     # AI vs AI 千局模拟（约 1.5–2 小时，SC-3）
npm run e2e          # Playwright（需先 npm run build）
npm run lint && npx tsc --noEmit
npm run build && npm run preview
npm run calibrate    # 教练阈值校准（novice/expert 分歧统计）
```

## 架构

四层（设计文档：`Y:\Zcodedata\.zcode\workspace\default\docs\plans\2026-08-28-guangdong-mahjong-trainer-design.md`）：

```
src/ui      React 页面与组件（移动优先，触控目标 ≥ 44px）
src/app     对局控制器 / 教练服务 / 计算服务 / 存储入口
src/domain  纯 TS 领域层（零框架零存储）：规则引擎、AI、题库
src/data    Repository 接口 + 内存 / IndexedDB 实现
```

分层纪律由 ESLint 强制（领域层禁止依赖框架与上层；UI/应用层只经 `src/data/repository` 接口访问存储，唯一组装点是 `src/app/store.ts`）。

## 约定

- 牌的 ID：`m1..m9`（万）`p1..p9`（筒）`s1..s9`（条）`z1..z7`（字）；计算密集处用 34 维计数向量
- 一切牌墙洗牌走可播种 RNG（mulberry32），对局可复现；对局快照 `{ v: 1, ... }` append-only
- 番种表数值、教练阈值为 **experimental**（待人工按家规核对，见 `docs/acceptance-2026-08-28.md` 人工待办）
- 题库（`src/domain/quiz/bank.json`）由引擎机械验证答案排序（`tests/domain/quiz/bank-quality.test.ts`）

## 验收

Success Criteria 走查与证据：`docs/acceptance-2026-08-28.md`。
