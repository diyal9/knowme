## MODIFIED Requirements

### Requirement: Dedicated composition workspace

编排工作室 MUST 作为稳定工作面展示 Graph 结构、节点检查器、校验问题、执行预览、保存和复制动作；不得只依赖一次性确认弹窗承载编辑。

专业模式 MUST 以**节点画布**呈现 Graph，并支持 **自由图编辑**：用户可通过端口连接节点、拖动节点更新坐标；边为显式草稿数据，非仅 relation 派生。轻量模式 MAY 使用垂直步骤列表与 relation。左侧 MUST 提供节点调色板（系统节点、扩展节点类型与可安装专家）与配置入口。

#### Scenario: Revise a generated graph

- **WHEN** 用户从目标生成 Graph 草案后选择继续编排
- **THEN** 工作室保留目标和草案，允许选择节点查看职责、Profile、Skill、权限、输入输出和连接关系，并在修改后重新校验

#### Scenario: Professional canvas free wiring

- **WHEN** 用户在专业模式下从输出端口拖到另一节点输入端口
- **THEN** 草稿 MUST 记录对应 edge；条件节点 MUST 能分别产生 `branch=true` 与 `branch=false` 的出边

#### Scenario: Select system start node

- **WHEN** 用户在画布上点击开始节点
- **THEN** 右侧检查器 MUST 展示流程定义（名称、目标、入参与出参），而不是专家步骤字段

#### Scenario: Lightweight mode remains step list

- **WHEN** 用户切换到轻量模式
- **THEN** 中间区域 MUST 以垂直步骤列表呈现专家顺序，并保留保存与测试运行动作

## ADDED Requirements

### Requirement: Specialty node kinds

专业调色板 MUST 支持添加 `llm`、`tool`、`knowledge`、`condition`、`join`、`gate` 与专家 `agent`。保存时 `llm|tool|knowledge|agent` MUST 绑定本地专家 Package；`tool` MUST 配置 skill；`knowledge` MUST 配置知识库 id。编译时 `llm|tool|knowledge` MUST 映射为 runtime `agent` 节点并保留 `studioKind`；`condition` MUST 映射为 runtime `condition`。

#### Scenario: Compile llm and condition graph

- **WHEN** 自由草稿含 llm → condition →（true）tool /（false）end
- **THEN** `toComposition` MUST 产出 agent+condition 节点与带 branch 的边，且 `validateDraft` 在合法绑定时 ok

### Requirement: Expert node card density

专业模式下每个可执行节点卡片 MUST 展示节点名称与类型相关摘要；卡片 MUST 具备可选中与移除控件（系统开始/结束除外不可删）。

#### Scenario: Agent card summary

- **WHEN** 草稿中存在已配置 intent 与 skillRefs 的专家节点
- **THEN** 卡片正文 MUST 显示该 intent 截断摘要，并反映 Skill 数量
