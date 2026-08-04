# Proposal — 任务工作间右栏可读性优化

## Why

当前「任务工作间」右栏对普通用户不友好，违反基本的阅读/操作/认知习惯：

1. **文字墙**：`renderTaskContext` 把 `factualBrief`（本是喂给 LLM 防臆造的多行事实串，含「禁止把任务输入路径当作产物…」等内部规则）原样打印到 `#wbRunStatus`，用户需逐行读键值对。
2. **状态自相矛盾**：`done` 任务顶部 meta 仍显示「流程执行中」，同时进度标签显示「已完成 1/1 步·100%」、状态区写「状态：done」，三处信号打架，破坏信任。
3. **黑话/路径泄漏**：降级原因把 `team-run`、`.cursor/workflows/` 等开发者术语直接暴露给用户，并在「参与助手」「执行节点」两处重复。
4. **绿色滥用**：进度标签、节点圆点、下一步高亮框都用绿色，成功语义被稀释。

## What Changes

- **结论优先**：右栏状态区改为「单句结论 + 语义色圆点 + 一行用户向说明」，不再打印内部事实串。`factualBrief` 仅继续用于 LLM 上下文注入，不再进入 DOM。
- **状态一致**：`done` 时顶部 meta 显示「已完成」，与进度、结论统一；消除「流程执行中 vs 已完成」矛盾。
- **去黑话/去重**：降级文案不再暴露 workflow id 与 `.cursor/workflows/` 路径；「参与助手」降级提示简化为一句，不与「执行节点」重复长原因。
- **语义色**：新增 tone（done/waiting/running/error/muted），绿色仅保留给「完成/成功」；等待=琥珀、执行=中性、失败=红、降级=灰。

## Impact

- Affected specs: `workspace`（任务工作间呈现）
- Affected code: `src/lib/workbench-task-brief.js`、`src/lib/workbench-task-projection.js`、`src/workbench.js`、`src/workspace.html`
- 纯函数新增 `tone`/`headline` 字段，附单测；不改状态机与 daemon 协议。
