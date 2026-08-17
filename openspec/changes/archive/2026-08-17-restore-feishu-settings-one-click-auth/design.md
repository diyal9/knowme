## Context

重构前 `settings.html` 的 `updateFeishuQuickCard` 根据 `userReady` / `docsKb` / `permissions.complete` 切换文案与主按钮。React 迁移后只剩「已连接 | 未连接」与「补充权限 | 一键授权」，语义丢失。主进程 `connectorsStatus('feishu')` 已附带 `permissionPlan` 与 `capabilities.docsKb`，渲染层可只读消费。

## Goals / Non-Goals

- Goals：封装飞书卡片 view-model；用户主路径一键授权；与重构前就绪语义对齐
- Non-Goals：改 IPC、改飞书 CLI、重做 MCP/Workbench

## Decisions

1. **纯函数封装**：在 `settings-connector-status.ts`（或同目录 `settings-feishu-card.ts`）导出 `buildFeishuCardModel(status, opts)`，输出 `{ statusText, primaryLabel, primaryDisabled, primaryMode, missingLabels, categories }`。组件只渲染与触发 IPC。
2. **主 CTA 策略（用户优先）**：
   - 未启用 / 未授权 / 文档知识库未齐 → `一键授权`（`full-auth`）
   - 已连接但扩展权限缺失 → `补充权限`（仍走确认面板，mode=`topup`）
   - 权限齐全 → `已连接` + disabled
3. **确认面板**：有 `permissionPlan.categories` 时渲染分类行；否则退回静态范围说明。
4. **空列表**：`extras.length === 0` 显示「暂无其他连接器。」
5. **高级设置**：`<details>` summary 补 caret，避免像孤立标题。

## Risks / Trade-offs

- 状态字段若偶发缺失，退回「一键授权」比误报「已连接」更安全。
- top-up stalled 轮询逻辑本 Story 只做轻量：缺权限持续存在时允许再次补充，不引入复杂 baseline 状态机（可后续加强）。

## Migration Plan

无数据迁移；仅 UI / 渲染判定。
