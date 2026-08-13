# Code Review Round 2 — fix-ai-generate-temporal-anchor

日期：2026-08-13  
对照：Round 1（反模式深度评估）中的 BLOCKING / ADVISORY。

## Round 1 → Round 2 消化情况

| ID | 项 | Round 1 | Round 2 |
|----|----|---------|---------|
| B1 | `ai-generate` 无顶层 try/catch | BLOCKING | **已关闭**：外层 `try/catch` → `fail(humanize)`；日志记 stack |
| B2 | 渲染层泄漏 Electron IPC 原文 | BLOCKING | **已关闭**：`agent-error-humanize.js` + workspace 双路径脱敏 |
| B3 | `cancelSubRun: () => {}` | BLOCKING | **已关闭**：`cancelAllSubRuns` + abort child controller + manager.cancelRun |
| A1 | God Handler ~1700 行 | ADVISORY | **仍开**：本 Story 未拆阶段；风险可接受但债仍在 |
| A2 | 巨袋 deps ~168 | ADVISORY | **部分缓解**：`assertRequiredDeps(AI_GENERATE_REQUIRED_DEPS)` 启动即炸；未全域拆袋 |
| A3 | require/deps 双轨 | ADVISORY | **部分缓解**：纯函数 `temporal-anchor` / `merge-extra-tools` 走 lib；有状态仍 deps |
| A4 | 守卫名单制 | ADVISORY | **部分缓解**：断言外层 catch / cancelAllSubRuns / assertRequiredDeps；全量结构扫描仍 advisory |
| A5 | deps 重复键 / 注册顺序 | ADVISORY | **部分缓解**：`mergeExtraTools` 已抽 lib；其它重复键未清 |
| A6 | 错误文案体验 | ADVISORY | **已关闭**（与 B2 合并） |

## Round 2 新发现

### [ADVISORY] God Handler 仍是最大残余风险

- **反模式**：认知负担 / 下次拆分再漏符号
- **预期**：prepare / tools / kernel / legacy 分模块
- **实际**：仍单文件 ~1700+ 行；本轮仅加了外壳防护，未降低内聚复杂度
- **建议**：另开 Story 拆 `ai-generate` 编排

### [ADVISORY] `assertRequiredDeps` 仅覆盖 ai-generate

- **反模式**：虚假安全感（其它 ipc 模块仍可漏 deps）
- **建议**：对 workbench-* / connectors 等高危模块逐步加 REQUIRED 列表

### [ADVISORY] 取消路径仍依赖 runtime 可选存在

- **反模式**：打断边界
- **实际**：无 team runtime 时仍 abort 本地 controller + cancelAllSubRuns；子 run 若只挂在其它总线，覆盖可能不全
- **建议**：后续用集成测覆盖「有子 run 时点停止」

### [OK] 用户可见错误路径

- 主进程：未捕获异常 → humanize → `{ error: 中文短句 }`
- 渲染：IPC reject / result.error 均再 humanize 一次
- 单测覆盖 ReferenceError / API Key / 网络失败

## 门禁快照

- npm test: PASS（1802）
- npm run lint: PASS
- 守卫：`ipc-free-helper-guard` + `agent-error-humanize` PASS

## Round 2 结论

- Round 1 的 **2 个 BLOCKING 均已关闭**，可进入制作人体验验收。
- 残余均为 ADVISORY（God Handler / 全域 deps 治理），不阻断本 Story，建议排后续债。
- 非正式 QA：制作人验收通过后再出 `test-report.md`。
