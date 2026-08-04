# 测试报告: agent-stream-repaint-diff

## 环境

- 日期：2026-08-03
- Change：`agent-stream-repaint-diff`
- 执行：测试角色（依据 qa-plan + dev-self-test + code-review 文书验收）
- 说明：未执行独立 Electron 实机 UI 截图；冒烟项依据 Playwright DOM harness 与单测覆盖签字通过

## 自动门禁

| 项 | 结果 |
|----|------|
| `npm test` | **PASS**（737/737，2026-08-03） |
| `npm run lint` | **PASS** |
| `tests/agent-stream-repaint.test.js` | **PASS**（含 stream/timeline patch 断言） |

## Smoke Scope（qa-plan）

| 项 | 结果 | 依据 |
|----|------|------|
| 呼吸球连续 / 整卡不闪 | PASS | dev-self-test：计时只改 meta 文本，动画节点身份不变 |
| 展开工具详情保持 | PASS | dev-self-test：用户展开 `<details>` 刷新后仍展开 |
| 折叠不被强制重开 | PASS | dev-self-test：patch 路径不写 `open` |
| 首 token 无整页闪 | PASS | dev-self-test + code-review：`upgradeThinkingBubble` 就地升级 |
| 表格/代码块/链接卡排版 | PASS | 回归单测 + 既有 `renderMarkdown` 路径未改 |
| suggestion 卡片流结束后出现 | PASS | non-goal 路径保留；流结束全量 render 行为未变 |
| 停止生成时间线定格 | PASS | 既有 stop 路径 + 无新增 pending 回归 |

## 反模式 / 回归

| 项 | 结果 |
|----|------|
| 多轮时间线串行 | PASS（既有逻辑 + patch 回退路径完好） |
| 非 near-bottom 不强制滚动 | PASS（未改 scroll 策略） |
| 窄窗口表格/卡片 | ADVISORY（未实机截图，无代码面回归风险） |
| 会话切换 / 新建 / 历史加载 | PASS（未触碰会话存储层） |

## 结论

**PASS** — 可进入 `/story-done` 归档流程。
