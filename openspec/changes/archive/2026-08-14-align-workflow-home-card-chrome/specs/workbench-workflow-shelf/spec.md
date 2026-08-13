## ADDED Requirements

### Requirement: Workflow home card matches manage card chrome without manage menus

工作流首页货架卡 MUST 采用与「维护我的工作流」管理卡一致的主体分区：上半为图标井 + 标题行 + 说明 + 输入/产出摘要条，下半为「简要流程」步骤条。工作流首页卡 MUST NOT 在右上角或其它区域展示管理页的复制 / 编辑 / 删除菜单按钮；来源标识（如「官方」「我的」）可用徽章展示。

#### Scenario: Home card has manage-like zones without action icons

- **WHEN** 用户在工作流首页查看任一工作流卡片
- **THEN** 卡片可见上半信息区与下半简要流程区，且不见复制、编辑、删除图标按钮

#### Scenario: Manage page still shows action icons

- **WHEN** 用户打开「维护我的工作流」并查看个人工作流卡
- **THEN** 该卡右上角仍可见复制、编辑、删除图标按钮

### Requirement: Workflow home card footer keeps run status with template-modified copy

工作流首页货架卡 MUST 在简要流程区下方保留页脚：左侧展示步骤数与模板修改相对时间（有有效 `updatedAt` 或 `createdAt` 时文案为「模板修改于 {相对时间}」，并提供绝对时间提示）；右侧 MUST 仅提供「开始运行」图标按钮。无有效时间戳时 MUST NOT 显示占位假日期。MUST NOT 使用「更新于」作为该页脚时间前缀。

#### Scenario: Footer shows template-modified time and run only

- **WHEN** 用户浏览带有有效时间戳的工作流首页卡片
- **THEN** 页脚左侧可见「N 步 · 模板修改于 …」，右侧仅见开始运行图标

#### Scenario: Missing timestamp omits time copy

- **WHEN** 某工作流包没有可解析的更新或创建时间
- **THEN** 页脚不显示模板修改时间文案，步骤数与运行按钮仍按既有规则展示
