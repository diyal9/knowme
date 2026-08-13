## ADDED Requirements

### Requirement: Root LLM Wiki operation hub

The knowledge home SHALL present Query, Ingest, and Lint as its three primary user actions. Query MUST use the same root LLM Wiki service used by system and Agent callers, MUST prefer qmd when available, and MUST disclose when retrieval degraded to the local fallback without blocking knowledge use.

#### Scenario: Query structured knowledge with qmd

- **WHEN** 用户在“我的知识”首页提交查询且 qmd 可用
- **THEN** 系统通过根 LLM Wiki 服务返回带标题、路径和摘要的命中结果
- **AND** 首页显示当前使用 qmd 检索
- **AND** 用户可从命中结果打开对应资料

#### Scenario: Query degrades honestly

- **WHEN** 用户提交查询但 qmd 不可用或执行失败
- **THEN** 系统回退到本地检索且查询仍可完成
- **AND** 首页以普通用户可理解的文案说明当前使用本地检索
- **AND** 系统 MUST NOT 声称 qmd 已成功执行

#### Scenario: Ingest from the hub

- **WHEN** 用户在首页选择“添加资料”
- **THEN** 系统打开根 LLM Wiki 添加资料流程
- **AND** 成功内容写入可编辑的 `raw/` 区并刷新检索状态

#### Scenario: Lint from the hub

- **WHEN** 用户在首页选择“检查问题”
- **THEN** 系统通过统一根 LLM Wiki Lint 服务检查空内容、重复标题、断链或其他受支持问题
- **AND** 用户可查看问题详情或健康通过状态

### Requirement: Professional graph handoff

KnowMe SHALL expose a visible secondary action to open the current root LLM Wiki in Obsidian for relationship-graph exploration. The default knowledge surface MUST NOT implement or present a competing in-app graph canvas.

#### Scenario: Open installed Obsidian

- **WHEN** 用户选择“在 Obsidian 中打开”且 Obsidian 已安装
- **THEN** 系统通过现有桥接打开当前根 LLM Wiki

#### Scenario: Guide an uninstalled user

- **WHEN** 用户选择“在 Obsidian 中打开”但 Obsidian 未安装
- **THEN** 系统提供官方下载引导
- **AND** 用户知识数据保持不变

#### Scenario: Default surface avoids graph internals

- **WHEN** 普通用户打开知识网默认首页
- **THEN** 页面不展示自建图谱画布
- **AND** 页面不以 Fabric、织网或 authority 作为主流程术语
