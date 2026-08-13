# agent-workbench (delta)

## MODIFIED Requirements

### Requirement: Daemon 常用交付路径

Daemon / 管线服务 SHALL 仍维护策展后的交付路径集合（primary ≤4、其余入更多），但路径集合 MUST 用于「创建管线任务」中的路径选择，MUST NOT 作为管线服务 Tab 左侧默认主列表。路径说明与阶段摘要 MAY 在创建对话框或帮助文案中展示。

#### Scenario: 路径用于创建而非首屏目录墙

- **WHEN** 用户打开管线服务 Tab
- **THEN** 左侧默认不是路径目录墙
- **WHEN** 用户打开「创建管线任务」
- **THEN** 可选择策展后的交付路径（含更多路径）

#### Scenario: 锁定路径仍不可启动

- **WHEN** 用户选择 locked 路径
- **THEN** 「开始开发」禁用并提示路径不可用

### Requirement: Daemon 材料体检（软门禁）

材料体检 SHALL 移至创建管线任务流程（及任务审阅中对输入的回顾），MUST 按所选路径解析 required ingest，而非仅在路径详情中栏展示通用芯片。服务离线或路径 locked 时 MUST 硬禁用启动；路径未声明 hardness 的业务材料默认可为软提醒；声明为 hard 的缺失输入 MUST 阻止启动。

#### Scenario: 离线硬阻拦

- **WHEN** 管线服务离线
- **THEN** 新建启动入口禁用或提交失败，并提示连接状态

#### Scenario: 声明 hard 的缺失材料

- **WHEN** 用户新建任务且路径要求 hard 需求文档但未提供
- **THEN** 提交被阻止且清单标明待补

#### Scenario: 软提醒仍可启动

- **WHEN** 仅缺失软等级补充材料且文本/文件最小门槛已满足、服务在线且路径未 locked
- **THEN** 允许「开始开发」并可见软警告

### Requirement: Daemon 管线记录

管线服务 SHALL 以「管线任务」列表呈现 Daemon runs（数据源仍为 Daemon tasks/runs）。列表项标题优先 intent；每条 SHALL 给出状态与下一动作。界面文案 MUST 使用「管线任务」等限定语区分顶栏「任务」Tab 中的本机专家任务，MUST NOT 暗示二者为同一列表。

#### Scenario: 记录人话化

- **WHEN** 存在带 intent 的 Daemon run
- **THEN** 列表主标题为 intent（可附 slug/元数据）

#### Scenario: 筛选需要你处理

- **WHEN** 用户选择「需要你」筛选
- **THEN** 仅展示等待门禁、澄清或失败需处理的管线任务

#### Scenario: 选中进入审阅

- **WHEN** 用户选中一条管线任务
- **THEN** 右侧审阅/状态区绑定该条目更新，而非打开路径开工台

### Requirement: Daemon 运行审阅优先

打开管线任务详情（右侧审阅面或既有运行页）时，界面 SHALL 优先呈现进度/状态、需要你处理的动作与产物；参与专家列表与原始运行日志默认折叠或次要，用户可展开。

#### Scenario: 默认强调状态与产物

- **WHEN** 用户查看某管线任务的审阅区域
- **THEN** 可见状态与产物/步骤入口
- **AND** 运行日志不默认抢占总视觉面积
