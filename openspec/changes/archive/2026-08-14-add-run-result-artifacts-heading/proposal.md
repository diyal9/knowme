## Why

管线/工作流结束态结果页右侧缺少与对话右栏一致的标题层级：应先有小标题（如「工作流」），再跟加粗主标题（工作流名），产物列表作为下级分区。先前单行「产物」标题过扁，与既有右栏样式不对齐。

## What Changes

- 结束态结果页增加堆叠标题头：小标题（工作流/任务）+ 主标题（工作流名或目的标题）。
- 产物列表上方保留次级小标题「产物（N）」。
- 右栏 `.wb-side-workflow-name` 改用 `--wb-text`，字号与结果页主标题对齐。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：结束态产物区 MUST 展示分区小标题，且标题层级对齐对话右栏。

## 目标用户

- 在工作台查看运行结果、打开产物文件的知识工作者。

## 验收标准

- 结果页顶部可见「工作流」小标题 + 工作流名主标题（样式对齐右栏参考）。
- 有产物时，列表上方可见「产物（N）」次级小标题。
- 「再跑一次」「查看执行过程」与顶栏「返回」行为不变。

## 非目标（Non-goals）

- 不改产物条目样式、打开逻辑或 ingest 过滤。
- 不改 Daemon 审阅 Tab「制品」文案。
- 不重做结果页整体布局。

## Impact

- `src/workbench.js`、`src/workbench-shelf.css`、`src/workbench-layout.css`
- 相关契约测试
