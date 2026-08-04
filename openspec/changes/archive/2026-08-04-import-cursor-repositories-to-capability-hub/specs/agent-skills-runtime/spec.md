## ADDED Requirements

### Requirement: Runtime loads registered linked skills
Agent Skills Runtime MUST 将已启用的 Cursor 仓库技能与已复制到 capabilities 的标准技能合并为同一技能列表，并从注册来源读取技能内容。

#### Scenario: Linked skill appears in picker
- **WHEN** Cursor 仓库技能已注册且启用
- **THEN** 技能选择器与自动匹配可发现该技能
- **AND** L0 元数据来自其 SKILL.md

#### Scenario: Linked skill is disabled
- **WHEN** 用户在 Hub 禁用已注册仓库技能
- **THEN** 技能选择器、自动匹配和工具调用不再提供该技能

### Requirement: Linked resources and scripts remain repository-confined
运行时 MUST 以技能目录和仓库根目录双重边界解析链接技能资源；资源读取仅允许现有资源目录，脚本执行仅允许技能 `scripts/` 且 MUST 经过 sandbox 权限。

#### Scenario: Read repository-linked reference
- **WHEN** Agent 请求已注册技能的 `references/example.md`
- **THEN** 运行时读取原仓库技能目录中的对应文件

#### Scenario: Linked path escapes repository
- **WHEN** 注册元数据或资源请求解析到仓库根目录之外
- **THEN** 运行时拒绝加载并返回非法路径错误

### Requirement: Missing linked source degrades honestly
链接技能来源不存在、不是目录或不再包含 SKILL.md 时，运行时 MUST 将其视为不可用，不得回退到过期内容或伪造成功。

#### Scenario: Repository was moved
- **WHEN** 已注册技能的来源目录无法访问
- **THEN** 技能不进入可执行列表
- **AND** Hub 可显示来源丢失状态
