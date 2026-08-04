# Spec Delta: workspace — 工作流启动弹窗 DAG 分支预览

## ADDED Requirements

### Requirement: Launch dialog DAG preview reflects real branches

工作流启动弹窗右侧的「DAG 关系图」MUST 基于 `buildWorkflowGraph()` 的 `edges` 渲染真实分支结构，MUST NOT 仅将节点拍平成线性列表。

#### Scenario: Render branch edges with labels

- **GIVEN** 用户打开一个含并行 / 网关 / 循环节点的工作流启动弹窗
- **WHEN** 右侧关系图渲染
- **THEN** 具有多条出边的节点 MUST 渲染为分支组，逐条显示边标签（如 通过 / 打回 / 修订 / 并行 / 汇合 / 检查 / 修复 / 成功）与目标节点标题
- **AND** 边标签 SHOULD 按语义着色（通过/成功=正向绿、打回/失败/耗尽=警示红、修订/修复/检查=琥珀、并行=分叉色、汇合=中性）

#### Scenario: Back edges reference upstream nodes without duplication

- **GIVEN** 工作流存在指向已出现上游节点的边（如循环回环、汇合）
- **WHEN** 关系图渲染到该边
- **THEN** MUST 以「↩ 回到 <目标节点标题>」形式引用该上游节点
- **AND** MUST NOT 重复渲染该节点卡片

#### Scenario: Linear workflow stays clean

- **GIVEN** 工作流为单一顺序链（每节点最多一条无标签出边）
- **WHEN** 关系图渲染
- **THEN** 节点间 MUST 以简洁竖向连接箭头相连
- **AND** 有标签的顺序边 MAY 在连接器上显示标签芯片

#### Scenario: Node styling by type

- **GIVEN** 关系图渲染节点卡片
- **THEN** 每个节点 MUST 按类型（agent / script / loop / parallel / gate / terminal）显示对应左侧色栏与类型标签
- **AND** 入口节点 MUST 带「起点」徽标与高亮描边
- **AND** 弹窗侧栏保持只读预览，MUST NOT 引入第三方图库

#### Scenario: Degrade when graph unavailable

- **GIVEN** 工作流加载失败或无节点
- **WHEN** 关系图渲染
- **THEN** 面板 MUST 降级为提示态（`.degraded`），显示错误或兜底文案，MUST NOT 抛错
