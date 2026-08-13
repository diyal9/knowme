## ADDED Requirements

### Requirement: Expert cards lead with the display name

能力 Hub 的专家卡片与精选卡片 MUST 以展示名作为标题。当展示名与原始标识（`originName`）不同时，原始标识 MUST 降级展示：卡片副标题 MUST 在分类与来源之后附带原始标识，详情抽屉的元信息 MUST 有一行「原始标识」。搜索 MUST 同时匹配展示名与原始标识。

#### Scenario: Browse imported experts

- **WHEN** 用户打开「全部专家」，列表中包含从 Cursor 仓库导入的专家
- **THEN** 卡片标题显示中文展示名，与内置专家的命名风格一致
- **AND** 卡片副标题在「分类 · 来源」之后显示原始标识

#### Scenario: Search by original slug

- **WHEN** 用户在搜索框输入 `ui-expert`
- **THEN** 展示名为「UI 专家」的那张卡片仍被命中

#### Scenario: Inspect provenance in the drawer

- **WHEN** 用户打开该专家的详情抽屉
- **THEN** 抽屉标题为展示名，元信息中可以看到原始标识
