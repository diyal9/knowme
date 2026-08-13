## Context

See proposal.md — Why。当前 `projectTaskRoom` 将 `nodeTypeLabel · owner · 产出 kind · path` 拼入 `graphNodes[].meta`，`renderDaemonReviewBody` 原样塞进 `<small>`，窄栏下必然换行杂乱。

## Goals / Non-Goals

**Goals**
- 投影层拆出可扫读的 `meta` 与可选 `outputLabel`/`outputTitle`
- 审阅步骤 UI 分层渲染 + CSS ellipsis

**Non-Goals（设计层）**
- 不引入折叠/展开交互
- 不改状态推断与进度条算法

## Decisions

1. **meta 只含类型与执行者**  
   理由：这是扫读「谁在干什么」的主信号。产出挪到独立字段，避免再拼 `·`。

2. **产出短名优先 path basename，其次 kind**  
   理由：`proto-changes.md` 对人可读；`proto_changes_doc` 属内部标识，仅在无 path 时回退。完整 path 进 `title`。

3. **UI 两行副文案：meta + 可选产出行**  
   理由：有/无产出时结构仍清晰；CSS `nowrap + ellipsis` 锁住垂直节奏。

## Risks / Trade-offs

- [悬停才看全路径] → 制品 Tab 仍有完整列表；tooltip 覆盖排查场景。
- [无 path 仅 kind 时仍偏技术] → 少见；后续可做人读映射，本 Story 不扩 scope。

## Migration Plan

纯前端投影与渲染；无数据迁移。回滚即恢复旧 meta 拼接即可。
