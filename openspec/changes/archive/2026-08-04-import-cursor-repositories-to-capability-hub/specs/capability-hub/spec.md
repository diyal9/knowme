## ADDED Requirements

### Requirement: Hub imports a Cursor repository through preview and confirmation
Capability Hub MUST 在添加能力对话框提供“Cursor 仓库”来源，并在写入前展示扫描预览、仓库路径、各类型数量与安全警告。

#### Scenario: User selects a Cursor repository
- **WHEN** 用户点击“选择 Cursor 仓库”并选中本地目录
- **THEN** Hub 展示该仓库发现的专家、技能和连接器摘要
- **AND** 用户可确认注册或取消且取消不产生写入

#### Scenario: Import reports partial failure
- **WHEN** 部分能力因无效格式或明文密钥无法注册
- **THEN** Hub 明确展示成功、跳过与失败条目
- **AND** MUST NOT 将部分失败静默显示为全部成功

### Requirement: User-installed capabilities are visible in the unified catalog
系统 MUST 将本地、ZIP、HTTPS、自定义和 Cursor 仓库来源的成功安装项合并到统一 catalog，使其可在 Hub 中搜索、筛选、启停和卸载。

#### Scenario: Local capability registration completes
- **WHEN** 任一非精选来源能力安装成功
- **THEN** 对应卡片立即出现在正确 Tab
- **AND** 卡片显示真实来源、安装状态和可用性

### Requirement: Local trust confirmation completes in the UI
未知本地来源返回需信任状态时，Hub MUST 向用户展示确认步骤，并仅在确认后以相同来源重试；拒绝信任 MUST 保持未安装状态。

#### Scenario: User confirms a local source
- **WHEN** 后端返回 `trust_required` 且用户确认信任
- **THEN** Hub 以显式信任标记重试导入
- **AND** 最终结果按成功或失败真实反馈

#### Scenario: User rejects trust
- **WHEN** 用户取消或拒绝本地来源信任
- **THEN** Hub 不写入能力
- **AND** 添加对话框保持可恢复状态
