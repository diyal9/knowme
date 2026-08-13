## Why

对照 Daemon WebUI：运行中左栏应同时呈现**进度交互**与**待处理澄清的具体问题**；右栏制品应是「预览 | 路径 | 大小」行卡。KnowMe 曾把过程日志迁出对话，HITL 卡也未达到 WebUI 待处理事项的信息密度，制品样式不一致，导致执行中左栏「像没有进度交互」。

## What Changes

- **A · HITL**：澄清/Gate 对话卡展示完整问题列表（对齐 WebUI「待处理事项」），支持卡内作答并提交；继续用既有 clarify/gate API。
- **B · 进度**：Daemon 运行中左栏重新投影**紧凑进度卡**（当前步、完成比例、等待态）；完整运行日志仍在右栏「过程日志」Tab，不回灌全文日志。
- **C · 制品**：右栏制品列表样式对齐 WebUI（预览 | 路径 | 大小的描边行卡）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：左栏进度卡 + HITL 问题密度；右栏制品行布局。

## 目标用户

在工作台跑管线任务、需要边看进度边回答澄清、并预览制品的知识工作者。

## 验收标准

1. 运行中左栏出现 Daemon 进度卡（步数/当前节点/等待态），而非仅助手工具「执行过程」。
2. need_input 时左栏 HITL 卡列出具体问题，可提交答复；Gate 可点通过/修订/打回。
3. 制品 Tab 每行：左侧预览、中间路径、右侧大小（有大小时）。
4. 右栏「过程日志」仍可看完整 progress/logs。
5. `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不 fork Daemon WebUI 全量中间列。
- 不把完整 daemon.log 重新灌回对话流。
- 不改 clarify/gate HTTP 契约。

## Impact

- `src/workbench.js`、`src/workspace-agent.js`、`src/lib/workbench-daemon-review.js`、`src/workbench-layout.css` / `workspace.html` 样式
- 契约测试与相关 OpenSpec evidence
