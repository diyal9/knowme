## ADDED Requirements

### Requirement: Imported experts get a Chinese display name

从 Cursor 仓库导入专家（含由技能生成的仓库专家）时，系统 MUST 推导一个面向用户的展示名，并按以下优先级取第一个可用结果：

1. 源 `name` 本身包含中文字符时，直接使用；
2. frontmatter 的显式标题字段（`displayName` / `title` / `nameZh` / `zhName`）；
3. `description` 前两段中以「专家 / 助手 / 伙伴 / 顾问 / 工程师」等角色词结尾的短语；
4. `AGENT.md` frontmatter 的 `persona.role`；
5. `description` 的首个短语；
6. 以上都推导不出时，MUST 保留源 `name` 原样，MUST NOT 机器拼接或音译。

第 2 至第 5 项的候选 MUST 先剥离 `中文：` / `English：` 这类语种前缀与括注内容，再按 `：`、`、`、`；`、`。`、`，` 等分隔符切分；候选 MUST 包含中文字符且 MUST NOT 超过 20 个字符，否则视为推导失败并继续下一优先级。

推导 MUST 是本地纯函数，MUST NOT 调用模型或访问网络。导入结果 MUST 同时保留源标识为 `originName`，用于展示原始 slug 与搜索。

#### Scenario: Agent package with a Chinese role

- **WHEN** 导入的 `AGENT.md` 中 `name` 为 `ui-expert`、`description` 以「UI 专家：」开头
- **THEN** 该专家的展示名为「UI 专家」
- **AND** `originName` 保留为 `ui-expert`

#### Scenario: Skill-generated repository expert

- **WHEN** 仓库没有 `.cursor/agents`，由主技能生成仓库专家，其 `description` 以「中文：RDPI 配置协作（Excel 优先）、…」开头
- **THEN** 语种前缀与括注被剥离，展示名为「RDPI 配置协作」
- **AND** `originName` 保留为 `rdpi-config-assistant`

#### Scenario: No Chinese information available

- **WHEN** 源包的 `name`、`persona.role` 与 `description` 都不含中文
- **THEN** 展示名保持源 `name` 原样，不做拼接或翻译

### Requirement: User rename survives repository re-scan

用户在专家编辑中修改专家名称并保存后，系统 MUST 把新名字同步到 install store 与 catalog overlay，并把该专家标记为用户命名。重新扫描或更新同一 Cursor 仓库时，对已标记为用户命名的专家 MUST 保留用户名字，MUST NOT 用源包名或推导名覆盖；其余字段（描述、技能绑定、系统提示词）仍按源包更新。

#### Scenario: Rename then re-import

- **WHEN** 用户把导入的专家改名为「美术打包专家」并保存，随后重新扫描并导入同一仓库
- **THEN** 该专家在能力 Hub 中仍显示「美术打包专家」
- **AND** 其技能绑定与描述按源包刷新

### Requirement: Existing imported experts are backfilled once

对升级前已导入、名字不含中文且未被用户改名的专家，能力服务 MUST 在初始化时做一次幂等回填，按同一套推导规则补写展示名，并同步 install store、catalog overlay 与专家包自身。回填 MUST 幂等：名字已含中文或已被用户改名时 MUST 跳过，MUST NOT 重复写盘。

#### Scenario: Upgrade with previously imported experts

- **WHEN** 用户升级后首次打开能力 Hub，本地已有名为 `artbundle-expert` 的导入专家
- **THEN** 该专家显示为中文名，且无需用户重新导入
- **AND** 再次启动应用时不会重复改写该专家的包文件
