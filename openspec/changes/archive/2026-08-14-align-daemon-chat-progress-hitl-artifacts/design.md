## Context

过程日志已迁右栏 Tab；HITL 已进对话但问题展示偏薄；制品行布局与 WebUI 不一致。接口（progress/logs/artifacts/clarify/gate）齐全。

## Goals / Non-Goals

**Goals**：左栏紧凑进度 + 完整 HITL 问题交互；制品行对齐 WebUI。  
**Non-Goals**：不回灌全文日志；不改 API。

## Decisions

1. **进度卡**：恢复 `syncDaemonProcessFeed` 写入，但改用 `projectChatProgressCard`：标题/进度条/当前步/等待文案 +「打开过程日志」；默认不展开全文 progress.md；logs 块不进左栏。
2. **HITL**：`resolveClarificationDisplay.questions` 渲染为有序列表；澄清卡增加可选 textarea，提交优先取卡内内容，否则取 composer；Gate 按钮保持。
3. **制品**：行结构 `预览 | path | size`，描边圆角卡；去掉行首文件图标主导视觉。
4. **与助手时间线区分**：Daemon 进度卡 `aria-label` / kicker 用「管线进度」，避免与 `renderExecutionTimeline`「执行过程」混淆。

## Risks / Trade-offs

- [左栏再次变吵] → 进度卡紧凑、日志不进对话。
- [问题 enrichment 延迟] → 保持 refresh 时 enrich 后再 syncTaskView。

## Migration Plan

无。旧 `setDaemonProcessFeed(null)` 清空路径改为投递紧凑卡。
