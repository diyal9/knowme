## Context

Daemon task-mode：中栏 `progress.md` + 运行日志；右栏审阅（步骤/制品/变更/事件）。KnowMe task-room：左 agent-col 对话，右 `wbRunner` 状态堆。客户端已有 `task` / `artifacts` / gate / clarify。

## Goals / Non-Goals

**Goals:** 双栏语义对齐 WebUI；轮询 progress/logs；右栏四 Tab；纯函数投影可单测。  
**Non-Goals:** SSE 日志流、完整 git worktree、本地 Team Runtime 非 daemon 模式大改。

## Decisions

1. **左过程 = 对话流固定「系统过程」块**，不替换 composer；占位符仍支持补材料。  
2. **右栏替换 daemon 的 `wb-task-context` 长列表** 为 review tabs；本机/agent-graph 保留旧 runner。  
3. **Tab 默认 steps**，角标「推荐」；推荐条可切换。  
4. **轮询**：在既有 `refreshDaemonTask` 中并行拉 progress/logs；events/changes 在切 Tab 或刷新时拉取。  
5. **文本响应**：client 增加 `requestText`（非 JSON 路径）。

## Risks

- 无鉴权 token 时 API 401 → 沿用 auth 失败处理。  
- logs 体量大 → 截断展示尾部。  
- changes 树结构异构 → 宽松 normalize + 空态。
