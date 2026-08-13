## Context

管理面 `#wbWorkflowManagePage` 当前用单列 `.wb-workflow-manage-item` 横条 + 顶栏 `#wbManageBack` 文字返回。货架侧已有 `wb-shelf-icon-btn`、步骤/参与者摘要与 DAG 预览可复用。

## Goals / Non-Goals

**Goals**

- 返回：隐藏左侧 `#wbManageBack` 文字钮；在面板头右侧提供图标返回（同语义回货架）
- 列表：两列 CSS grid；窄屏单列
- 卡片：上区简介/能力，下区简要流程；编辑/删除图标按钮

**Non-Goals**

- 不改 package 真源与 archive/edit 协议
- 不复制完整 DAG 面板到管理卡（用紧凑步骤条即可）

## Decisions

1. **返回位置**：面板标题区**左侧**使用 `wb-task-back`（图标 +「返回」），右侧仅保留「新建工作流」。`#wbManageBack` 在 workflows 面板保持隐藏；`#wbWorkflowManageBack` 绑定 `setSurface('shelf')`。
2. **流程摘要**：优先拓扑序节点标题（复用 `shelfPackageGraphView` / 参与者标签），渲染为水平 `A → B → C` 紧凑条，避免管理卡内嵌完整 `wb-dag-panel`。
3. **能力摘要**：上区展示 description/outcome，并用输入/产出 chip（对齐货架扫读语言）。
4. **图标**：复用 `wb-shelf-icon-btn` + `edit` / `trash`；删除按钮可加 danger 色类。

## Risks / Trade-offs

- 两列 + 下半流程会拉高卡片高度 → 限制步骤条最多展示 N 步并截断，避免单卡过高。
- 窄屏回落单列，避免挤压图标按钮。

## Migration Plan

无数据迁移；纯 UI。

## Open Questions

（无）
