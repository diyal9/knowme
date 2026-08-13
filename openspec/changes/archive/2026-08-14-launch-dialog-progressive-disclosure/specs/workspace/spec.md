## MODIFIED Requirements

### Requirement: Launch dialog DAG preview reflects real branches

工作流启动弹窗在用户展开「执行流程」详情后，右侧（或详情区域）的「DAG 关系图」MUST 基于 `buildWorkflowGraph()` 的 `edges` 渲染真实分支结构，MUST NOT 仅将节点拍平成线性列表。启动弹窗默认态 MUST NOT 常驻完整 DAG 半屏预览。

#### Scenario: Default launch shows summary instead of full DAG

- **GIVEN** 用户打开一个含节点的工作流启动弹窗
- **WHEN** 弹窗首次渲染且用户尚未展开执行流程
- **THEN** 界面 MUST 显示流程摘要（至少含步数）与「查看执行流程」入口
- **AND** MUST NOT 以完整节点列表/连接器占满半屏侧栏

#### Scenario: Expand reveals branch edges with labels

- **GIVEN** 用户打开一个含并行 / 网关 / 循环节点的工作流启动弹窗
- **WHEN** 用户点击「查看执行流程」（或等价入口）展开详情
- **THEN** 具有多条出边的节点 MUST 在卡片内以出口徽标逐条显示边标签（如 通过 / 打回 / 修订 / 并行 / 汇合 / 检查 / 修复 / 成功）与目标节点标题
- **AND** 边标签 SHOULD 按语义着色（通过/成功=正向绿、打回/失败/耗尽=警示红、修订/修复/检查=琥珀、并行=分叉色、汇合=中性）

#### Scenario: Back edges reference upstream nodes without duplication

- **GIVEN** 工作流存在指向已出现上游节点的边（如循环回环、汇合）且用户已展开执行流程
- **WHEN** 关系图渲染到该边
- **THEN** MUST 以「↩ 回到 <目标节点标题>」形式引用该上游节点
- **AND** MUST NOT 重复渲染该节点卡片

#### Scenario: Linear workflow stays clean when expanded

- **GIVEN** 工作流为单一顺序链（每节点最多一条无标签出边）且用户已展开执行流程
- **WHEN** 关系图渲染
- **THEN** 节点间 MUST 以简洁竖向连接箭头相连
- **AND** 有标签的顺序边 MAY 在连接器上显示标签芯片

#### Scenario: Node styling by type when expanded

- **GIVEN** 关系图在展开态渲染节点卡片
- **THEN** 每个节点 MUST 按类型（agent / script / loop / parallel / gate / terminal）显示对应左侧色栏与类型标签
- **AND** 入口节点 MUST 带「起点」徽标与高亮描边
- **AND** 详情区域保持只读预览，MUST NOT 引入第三方图库

#### Scenario: Degrade when graph unavailable

- **GIVEN** 工作流加载失败或无节点
- **WHEN** 摘要或关系图渲染
- **THEN** 面板 MUST 降级为提示态（`.degraded`），显示错误或兜底文案，MUST NOT 抛错

#### Scenario: Collapse returns to summary

- **GIVEN** 用户已展开执行流程详情
- **WHEN** 用户点击「收起流程」或等价入口
- **THEN** 界面 MUST 回到摘要态
- **AND** MUST NOT 丢失已填写的任务目标与上下文字段

## ADDED Requirements

### Requirement: Launch dialog engineering context is progressive

工作流启动弹窗的工程上下文字段（GitLab 项目 / 仓库、分支或 ref、固定 commit、输入/输出制品目录、资源路径）MUST 默认折叠在可展开区域；首屏 MUST 保留任务目标，并 MAY 保留任务标识与 PRD/asset 等与业务输入直接相关的字段。

#### Scenario: Engineering fields hidden by default

- **GIVEN** 用户打开 Daemon 工作流启动弹窗
- **WHEN** 弹窗首次渲染
- **THEN** GitLab 项目、分支/ref、commit、制品目录与资源路径 MUST 不在首屏平铺展开
- **AND** 用户 MUST 能通过「仓库与制品」或等价折叠区展开后编辑这些字段

#### Scenario: Expanded engineering fields still submit

- **GIVEN** 用户展开工程上下文字段并填写仓库与制品路径
- **WHEN** 用户点击「开始任务」
- **THEN** 系统 MUST 将这些字段按既有契约随启动请求提交
