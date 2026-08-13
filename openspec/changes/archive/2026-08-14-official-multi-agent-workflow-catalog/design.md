## Context

`remove-demo-workflow-seeds` 已停止注入空壳垂直切片。货架需要「真官方」参考标准：多 Agent、Gate、可复跑。本地执行路径已有 `AgentTeamWorkflowRunner` + `workbenchAgentGraph*`；个人包可走 `openSavedWorkflowGraph`，官方包此前未接同一路径。

## Goals / Non-Goals

- Goals：三条官方 Package 上架；依赖专家可安装；可启动并在 Gate 停顿；成为 Studio 参考。
- Non-Goals：不恢复 Demo；不强依赖 Daemon/图模；不改 Runner 内核。

## Decisions

1. **官方目录模块** `src/lib/official-workflows.js`  
   - 导出 `OFFICIAL_WORKFLOWS`（已 normalize 的 package 列表）与 `requiredExpertIds()`。  
   - `source: official`，`status: published`，`executionBackends: ['local-team']`。  
   - graph 使用 composition 形态：`members` + `nodes`（agent/gate/terminal）+ `edges` + `gates`。

2. **供给管道**  
   - `buildWorkflowShelf` 将官方列表作为 `verticals`/`collectSeeds` 输入；origin 显示为 seed 但 package.source 为 official（或扩展 origin=`official`）。  
   - 为避免「seed 优先级最低被空壳覆盖」，官方 origin 优先级 ≥ repo。  
   - 同 id 时官方完整包优先。

3. **专家**  
   - 新增 curated：`producer`、`developer`、`tester`、`meeting-scribe`、`action-owner`、`copywriter`、`visual-designer`。  
   - `office-partner` 复用于会议闭环末节点同步。  
   - workbench-load 幂等 `ensureOfficialWorkflowExperts()`：未安装则 `installCurated`。

4. **启动**  
   - `startWorkflowRun`：无 path 且存在 graph.nodes 时，`official` 与 personal/forked 一样走 `openSavedWorkflowGraph`。

5. **去重**  
   - `.cursor/workflows/team-run` → `catalog.visibility: deprecated`。  
   - 旧 Demo id 保留在 `workbench-console-model` 仅供历史 resolve，不上架。

## Risks / Trade-offs

- 专家增多：控制为薄 EXPERT.md，绑定已有 Skill。  
- 视觉无图模：人审 Gate 仍可交付文案/提示词；卡片文案写清。  
- origin=seed 与官方徽章：UI 用 `package.source === 'official'`，不依赖 origin 字段。

## Migration

- 用户已有「会议纪要」个人副本保留。  
- 自动化仍可用旧 seed id 解析（兼容）。
