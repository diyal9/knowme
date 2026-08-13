## Context

`wbStudioHeadNav` 内 `strong` 写死「编排工作流」，`#wbStudioTopMeta` 含工作流名。见 proposal.md - Why。纯渲染层。

## Goals / Non-Goals

**Goals:** 主标题 = 可编辑名称；副行场景标签 =「编排工作流」。

**Non-Goals:** 不改 package schema；不强制保存。

## Decisions

1. **结构**：`#wbStudioTitle` 为 button 展示名；编辑态换成 `#wbStudioTitleInput`；`#wbStudioTopMeta` 文案前缀固定「编排工作流」。
2. **交互**：单击进入编辑；Enter 提交、Esc 还原、blur 提交；空名回退原名或默认「我的专家协作」。
3. **状态**：`studioDraft.name` + `dirty`；若 Inspector 有 `data-studio-workflow-field="name"` 则同步 value。
4. **官方包**：仍可改草稿名（保存侧既有 official_readonly / fork 约束不变）。

## Risks / Trade-offs

- [误触改名] → 需显式点击标题；Esc 可取消。
- [与 Inspector 双向同步] → 顶栏提交写 draft；Inspector 既有 sync 路径覆盖，渲染时读 draft。

## Migration Plan

纯前端；回滚 HTML/JS/CSS 即可。
