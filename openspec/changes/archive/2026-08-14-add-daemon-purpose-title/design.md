## Context

See proposal.md — Why. 执行间已有 `elRunnerTitle` / `wbStartTitle` 与 `compactDaemonCardTitle`；便签侧已有 `ai-suggest-title` IPC。本变更把二者接到 Daemon 运行身份区。

## Goals / Non-Goals

**Goals:**

- 统一 Daemon 运行标题格式：`Daemon 阶段 · {purposeTitle}`
- LLM 提炼 + 本地 compact 回退；异步不阻塞启动
- 主链路验收可脚本化，API 失败即停

**Non-Goals:**

- 不新增 Daemon HTTP 字段
- 不改 Agent Graph / 本地工作流标题规则

## Decisions

1. **标题落点**：主展示在 `wbRunnerTitle`（审阅面上方身份行）；`wbStartTitle` 在 daemon mode 同步为同一目的标题，顶栏副文案仍为节点进度。
2. **提炼通道**：复用主进程 `ai-suggest-title`（assist 档模型）；渲染侧 `ensureDaemonPurposeTitle()` 先写 compact，再 await LLM。
3. **回退链**：`purposeTitle` 草稿 → LLM → `compactDaemonCardTitle(intent)` → 工作流显示名 → `管线任务`。
4. **文案前缀**：固定 `Daemon 阶段 ·`，与截图认知对齐；目的部分不含前缀重复。
5. **验收脚本**：`evidence/daemon-mainchain-check.js` 调本地 Daemon client：overview → 选一 workflow launchContext → 读最近任务 task/progress；任一步 HTTP/网络失败则 exit 非零并写 JSON，不重试轰炸。

## Risks / Trade-offs

- [LLM 延迟] → 先本地标题，返回后刷新  
- [无 API Key] → 静默走 compact，不 toast 打扰  
- [长 intent 费用] → 截断送入 suggest（与便签一致，首段/限长）

## Migration Plan

无数据迁移。旧任务打开时按 intent 现算；可选写入 `taskDraft.purposeTitle`。
