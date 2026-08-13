## MODIFIED Requirements

### Requirement: Specialty node kinds

专业调色板 MUST 支持添加 `llm`、`tool`、`knowledge`、`condition`、`join`、`gate` 与专家 `agent`。保存时 `llm|tool|knowledge|agent` MUST 绑定本地专家 Package；`tool` MUST 配置 skill；`knowledge` MUST 配置知识库 id。编译时 `llm|tool|knowledge` MUST 映射为 runtime `agent` 节点并保留 `studioKind`；`condition` MUST 映射为 runtime `condition`。

专业画布内联编辑 MUST 在 `llm|tool|knowledge` 节点卡片上暴露「执行专家」选择，使用户无需仅依赖右侧属性面板即可满足绑定校验。从调色板新增上述 specialty 节点时，若存在可用本地专家且节点尚未绑定，MUST 预填一位默认可执行专家。

#### Scenario: Compile llm and condition graph

- **WHEN** 自由草稿含 llm → condition →（true）tool /（false）end
- **THEN** `toComposition` MUST 产出 agent+condition 节点与带 branch 的边，且 `validateDraft` 在合法绑定时 ok

#### Scenario: Specialty card exposes expert bind

- **WHEN** 用户在专业画布查看或编辑 `knowledge` / `tool` / `llm` 节点卡片
- **THEN** 卡片内联字段 MUST 包含执行专家选择（`agentPackageId`），保存前可直接绑定

#### Scenario: Palette add pre-binds local expert

- **WHEN** 用户从调色板添加 `knowledge`（或 `tool` / `llm`）且工作台存在至少一位可编辑本地专家
- **THEN** 新建节点 MUST 带有非空 `agentPackageId`（默认为候选列表首位），用户仍可在卡片上改选
