# 验收记录（Success Criteria 走查）

日期：2026-08-28 · 版本：v0.1.0（commit 见 git log）

| # | 验收标准 | 验证方法 | 状态 | 证据 |
|---|----------|----------|------|------|
| 1 | 三流派 ruleset 下胡牌判定与番数计算通过全部单元测试（每番种谓词 ≥ 2 用例，含叠加、杠后自摸、起胡过滤） | Vitest | ✅ 代码侧通过 | `tests/domain/score.test.ts` 19 用例 + `tests/domain/rulesets.test.ts`；⚠️ 番种**数值**为 experimental，待人工核对（见下方「人工待办」#1） |
| 2 | 向听数算法通过已知答案牌型集（0–3 向听边界、七对路径、十三幺、碰杠后手牌） | Vitest | ✅ | `tests/domain/shanten.test.ts` 13 例已知答案 + 性能冒烟 |
| 3 | AI vs AI 自动模拟 1000 局无异常，牌数守恒不变量全程成立；AI 单决策 < 50ms | 自动化模拟 | 🔄 运行中 | `npm run test:sim`（本地后台执行中；100 局冒烟已过：守恒成立、平均 20.39ms/决策、胡牌率 53%） |
| 4 | 真机完整打完一局陪练、看到分歧点复盘、无可感知卡顿 | 人工验收 + E2E | 🟡 E2E 过 / 真机待做 | `tests/e2e/play.spec.ts`（自动演示整局 + 结算 + 复盘面板）；**真机录屏待用户执行** |
| 5 | 首启引导选流派 → 刷新保留；设置页可换流派 | E2E | ✅ | `tests/e2e/settings.spec.ts` |
| 6 | 计算器 < 500ms；听牌/进张/番数与手工推演一致（抽样） | 性能断言 + E2E | 🟡 代码侧过 / 真机待做 | `tests/app/calc-service.test.ts`（均值 < 50ms，预算 1/10）；`tests/e2e/calculator.spec.ts` |
| 7 | 对局中刷新 → 提示恢复 → 从快照继续 | E2E | ✅ | `tests/e2e/restore.spec.ts` |
| 8 | 学习中心章节练习、进度与错题本、随机练习 | 人工验收 + E2E | 🟡 E2E 过 / 建议人工走查 | `tests/e2e/learn.spec.ts` |
| 9 | 设置页导出/导入全部数据（JSON） | E2E（导出→清→导入一致） | ✅ | `tests/e2e/settings.spec.ts` |

## 自动化命令

```bash
npm test        # 快速单元套件（125 用例）
npm run test:sim  # AI vs AI 千局模拟（约 1.5–2 小时，CI 已单独限时）
npm run e2e     # Playwright 7 条（需先 npm run build）
npm run lint && npx tsc --noEmit && npm run build
```

## 人工待办（发布门槛）

1. **番种表核对（M2 Task 11 门禁）**：对照你的家规/公开牌例核对 `src/domain/rulesets/*.json` 三份番种表（起胡、封顶、每个番种数值与叠加互斥）。修正后同步更新 `tests/domain/score.test.ts` 期望值。番种表在设置页与学习中心均有全文展示，便于逐项核对。
2. **真机验收（SC-4、SC-6 真机部分）**：手机浏览器打开部署 URL → 完整打一局陪练（无可感知卡顿）→ 查看复盘 → 计算器摆 13 张（< 500ms）→ 添加到主屏幕验证 PWA。
3. **教练阈值确认**：`src/app/coach.ts` 的 `COACH_THRESHOLDS`（进张差 ≥ 2）与 AI 权重为 experimental，运行 `npm run calibrate`（校准脚本）后按体感调整。
4. **部署**：推送 GitHub 后在仓库设置启用 Pages（CI 已含 deploy job）；本地预览 `npm run build && npm run preview`。

## 已知偏差（对实施计划的偏离记录）

- 题库 v1 手工精做题 12 道（计划写 ≥ 60）：以质量优先，随机练习模式已可无限出题补足量；扩充题库按 `bank.json` 现有格式追加即可。
- 计算器 UI 未提供副露编辑入口（服务层 `calculate` 已支持 melded 参数）：v1.1 补 UI。
- 番种表数值、教练阈值、结算规则均为 experimental 初值，待 #1 核对。
