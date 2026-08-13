## Why

管线任务卡片把完整 `intent`（含「需求文档：」与飞书长 URL）直接当标题，列表扫读时像一堆文字，主信息被链接淹没。需要把卡片标题收成短可读摘要，完整原文留给悬停/详情。

## What Changes

- 管线任务列表卡片的主标题改为 **compact 摘要**（优先短语义行，跳过纯 URL / 空标签行），不再整段粘贴 intent。
- 悬停 `title` 与搜索仍可使用完整 intent。
- 卡片标题 CSS 收敛为单行省略，避免 URL 折成两行墙。
- 补充单元测试覆盖「标签 + URL」与正常短 intent。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pipeline-task-workbench`：管线任务列表标题从「优先整段 intent」改为「优先 compact 摘要，intent 完整文案次要暴露」。

## Impact

- 代码：`src/lib/workbench-daemon-surface.js`、`src/workbench-console.css`、`tests/workbench-daemon-surface.test.js`（渲染仍走既有 `daemonTaskCardView`）。
- 用户：管线服务「全部任务」列表扫读更清晰；不改任务数据与创建流程。
