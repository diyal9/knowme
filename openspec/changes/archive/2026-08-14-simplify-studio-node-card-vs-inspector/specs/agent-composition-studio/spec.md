## MODIFIED Requirements

### Requirement: Specialty node kinds

专业调色板 MUST 支持添加 `llm`、`tool`、`knowledge`、`condition`、`join`、`gate` 与专家 `agent`。保存时 `llm|tool|knowledge|agent` MUST 绑定本地专家 Package；`tool` MUST 配置 skill；`knowledge` MUST 配置知识库 id。编译时 `llm|tool|knowledge` MUST 映射为 runtime `agent` 节点并保留 `studioKind`；`condition` MUST 映射为 runtime `condition`。

专业画布上 `llm|tool|knowledge` 节点卡片 MUST 以只读摘要展示执行专家绑定状态（已绑定专家名或「未绑定专家」）；编辑绑定 MUST 仅在右侧属性面板完成。从调色板新增上述 specialty 节点时，若存在可用本地专家且节点尚未绑定，MUST 预填一位默认可执行专家。

#### Scenario: Compile llm and condition graph

- **WHEN** 自由草稿含 llm → condition →（true）tool /（false）end
- **THEN** `toComposition` MUST 产出 agent+condition 节点与带 branch 的边，且 `validateDraft` 在合法绑定时 ok

#### Scenario: Specialty card shows expert bind summary

- **WHEN** 用户在专业画布查看 `knowledge` / `tool` / `llm` 节点卡片
- **THEN** 卡片 MUST 显示执行专家绑定摘要（名称或未绑定），且 MUST NOT 在卡片上提供执行专家下拉控件

#### Scenario: Specialty expert edited in inspector

- **WHEN** 用户选中 specialty 节点并在属性面板更改执行专家
- **THEN** 草稿 `agentPackageId` MUST 更新，且画布卡片摘要 MUST 在下次渲染反映新专家名

#### Scenario: Palette add pre-binds local expert

- **WHEN** 用户从调色板添加 `knowledge`（或 `tool` / `llm`）且工作台存在至少一位可编辑本地专家
- **THEN** 新建节点 MUST 带有非空 `agentPackageId`（默认为候选列表首位），用户仍可在属性面板改选

### Requirement: Professional canvas nodes show agentUniverse-style sectioned summaries

专业编排画布 MUST 将每个节点渲染为分区摘要卡（类型色头栏 + 一个或多个只读摘要区），使作者无需打开属性面板即可扫读输入 / 配置 / Prompt / 输出要点。卡片 MUST NOT 提供可编辑的 input、textarea 或 select（含执行专家、知识库、技能、条件比较等）；全部字段编辑 MUST 仅在右侧属性面板完成。

#### Scenario: Start node exposes input summary section

- **WHEN** 自由图或线性板含开始节点且草稿定义了工作流输入
- **THEN** 开始节点卡片 MUST 展示「输入」类摘要区列出输入标签（空时用默认占位）

#### Scenario: LLM node exposes prompt summary section

- **WHEN** 画布上存在带 prompt 或模型配置的 `llm` 节点
- **THEN** 卡片 MUST 以只读分区展示模型或 Prompt 预览及输出提示

#### Scenario: Expert / tool / knowledge nodes expose binding and IO summary

- **WHEN** 画布渲染 `agent` / `tool` / `knowledge` 节点
- **THEN** 卡片 MUST 含至少一行绑定资源摘要（专家 / 技能 / 知识库）或目标摘要，以及至少一行 IO 向摘要；MUST NOT 在卡片上出现对应下拉或文本框

#### Scenario: Condition node surfaces branch semantics

- **WHEN** 画布渲染 `condition` 节点
- **THEN** 卡片 MUST 只读展示比较摘要并表明双分支语义

#### Scenario: Inspector is the sole edit surface

- **WHEN** 用户需要修改节点名称、执行专家、知识库、技能、Prompt、条件或 IO 文案
- **THEN** 上述编辑 MUST 仅在右侧属性面板完成；画布卡片在选中后仅同步只读摘要

#### Scenario: Runtime graph unchanged by visual card richness

- **WHEN** 本视觉变更后保存或编译草稿
- **THEN** composition 节点类型、边与校验规则 MUST 与变更前一致（仅布局高度与展示方式变化）

## ADDED Requirements

### Requirement: Canvas card vs inspector mental model

专业画布 MUST 明确分工：画布负责拓扑与扫读，属性面板负责配置。选中可配置节点时，属性面板 MUST 展示与该节点族匹配的完整可编辑字段，且字段值 MUST 与卡片摘要同源。

#### Scenario: Selecting knowledge node opens editable inspector

- **WHEN** 用户点击画布上的知识库节点
- **THEN** 右侧属性面板 MUST 显示可编辑的节点名称、执行专家、知识库、检索目标等字段，且卡片本身无重复表单控件

#### Scenario: Empty selection keeps inspector idle

- **WHEN** 用户未选中任何节点或点击画布空白
- **THEN** 属性面板 MUST 提示点选节点以配置，画布卡片保持只读摘要
