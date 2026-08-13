## Context

Studio 左栏现有：节点/配置 Tab + 两列 palette + 搜索/专家列表。配置 Tab 与工作流管理功能重叠。专家列表混入全部 local agents，与「任务快捷启动只展示工作台绑定专家」产品约定不一致。

## Goals / Non-Goals

**Goals**

- 侧栏只保留组件调色板，更窄更紧
- 专家入图 → 二级弹窗 + 工作台绑定专家 + 多选确认
- 卡片 UI 与 `wb-task-quick-card`（对齐 hub 专家卡）一致

**Non-Goals**

- 拖拽入画布的专家列表保留不是目标；可后续补
- 已保存工作流切换入口不在本 change 重设计

## Decisions

1. **专家源**：复用 `workbenchQuickExperts()`（mode bindings ∩ 可用目录），与任务首页一致。
2. **多选弹窗**：`wb-modal-mask` 模式，内部 grid 复用 `wb-task-quick-card` 样式类，增加 `is-selected` + 勾选角标。
3. **Palette 分区**：在 `paletteTypes()` 增加 `group` 字段；`renderStudioPalette` 按 group 输出。
4. **配置 Tab**：HTML/JS 删除；已保存工作流仍在「管理 → 工作流」。

## Risks / Trade-offs

- 无法再从 Studio 侧栏一键拖「未绑定工作台」的专家 → 符合快捷任务同源约定；可点「库」添加绑定后再选。

## Migration

无数据迁移。旧草稿兼容。
