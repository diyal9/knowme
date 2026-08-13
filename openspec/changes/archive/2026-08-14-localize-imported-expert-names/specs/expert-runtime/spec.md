## ADDED Requirements

### Requirement: Expert package records its original identifier

专家包 MUST 能记录导入来源的原始标识 `originName`。`EXPERT.md` frontmatter 中存在 `originName` 时，读取与保存 MUST 原样保留，列表与详情 MUST 一并返回该字段，供上层展示原始标识与搜索使用。缺省时该字段为空字符串，且 MUST NOT 影响既有专家的解析与校验。

#### Scenario: Load an imported expert

- **WHEN** 读取一个由 Cursor 仓库导入、frontmatter 含 `originName: "ui-expert"` 的专家包
- **THEN** 返回结果包含 `originName` 为 `ui-expert`
- **AND** 名称、描述、技能绑定与系统提示词的解析结果不变

#### Scenario: Save keeps the original identifier

- **WHEN** 用户改名后保存该专家
- **THEN** 写回的 `EXPERT.md` 仍保留原有 `originName`
- **AND** 未携带 `originName` 的专家保存后不新增该字段
