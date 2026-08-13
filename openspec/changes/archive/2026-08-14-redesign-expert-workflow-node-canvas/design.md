## Context

- 线性草稿：有序 agent + `relation∈{serial,parallel,approval}` → join/gate。
- 专业画布第一轮：派生布局可视化。
- 第二轮：用户要求 **都要做** → 自由端口连线 + 更多节点类型（对标 AU 子集）。

## Goals / Non-Goals

**Goals**

1. `graphMode: free`：`nodes` + `edges` + `x/y`；端口拖线 `connect`，选边 Delete `disconnect`。
2. specialty kind：`llm|tool|knowledge|condition|join|gate`。
3. 编译进 Runtime 可执行 DAG；保存校验绑定专家与关键必需配置。
4. 轻量模式不破坏。

**Non-Goals**

- 任意 JS/表达式 if-else。
- 无专家绑定的「裸 LLM 节点」执行（必须挂本地 Package）。

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 自由图存储 | draft.`edges` + layout in composition | 可还原坐标 |
| 扩展执行节点 | 编译为 `agent` + profile | fail-closed、复用 executor |
| 条件 | 一等 `condition` 类型 | 分支边，非假 UI |
| 默认加节点连线 | 仅缺入边时接 start；出边由用户画 | 避免自动 end 边阻塞 branch upsert |
| connect 语义 | 同 from→to 边 **upsert** branch/label | 覆盖默认边 |
| 校验 | `validateDraft` 在保存 | 明确错误 toast |

## Risks

| 风险 | 缓解 |
|------|------|
| 与 linear fromGraph 混用 | free 带 edges/`graphMode` 分路径 |
| 条件死锁 | runner 对不可达分支 skip |
