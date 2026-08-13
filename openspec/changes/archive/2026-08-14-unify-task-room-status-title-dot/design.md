## Context

task-room 通栏 `#agentDialogueStatusBar` 已统一结构：模式标签 + 标题 +（可选 meta）+ 状态 + 返回。管线服务通过 `daemonRunIdentityTitle()` 把 `Daemon 阶段 · {目的}` 写进 `title` 且 `meta=''`。协作/工作流仍把副身份放在 `#agentDialogueStatusMeta`（灰色轻字），与管线扫读节奏不一致。

## Goals / Non-Goals

**Goals**

- 协作、工作流在存在副身份时，将 `title` 设为 `{primary} · {secondary}`，`meta` 置空。
- 三类界面顶栏结构一致：徽章 + 单行标题（可含 `·`）+ 状态 + 返回。

**Non-Goals**

- 不改徽章配色、返回逻辑、Daemon 目的标题生成算法。

## Decisions

1. **在 `dialogueStatusProjection` 统一拼接**  
   对 `mode` 为「协作」「工作流」的投影，若 `meta` 非空且不同于 `title`/`mode`，则 `title = `${title} · ${meta}``，`meta = ''`。管线服务路径保持现状（标题内已含 `·`）。

2. **不隐藏模式徽章**  
   用户对照截图仍保留「协作 / 工作流 / 管线服务」标签；只统一标题内分隔符。

3. **CSS**  
   优先不改样式；若标题变长被截断过狠，仅放宽 `.agent-dialogue-status-title` 的 `max-width`。

## Risks / Trade-offs

- [副文案并入标题] → 长目标可能被 ellipsis；可接受，与 Daemon 长标题同策略。
- [协作「目标 · 专家名」略重复] → 按用户要求与管线语法对齐，保留完整信息。

## Migration Plan

无数据迁移。刷新工作台即可。

## Open Questions

无。
