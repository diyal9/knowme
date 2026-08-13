# agent-workbench (delta)

## MODIFIED Requirements

### Requirement: 工作台一级导航

工作台顶栏 SHALL 提供「任务 / 工作流 / Daemon」三个平级 Tab，默认停在「任务」。运行页与编排页为带返回入口的全屏页，此时三 Tab 隐藏。搜索框仅在「工作流」Tab 显示。

#### Scenario: 默认进入任务首页

- **WHEN** 用户进入工作台
- **THEN** 顶栏显示「任务 / 工作流 / Daemon」三 Tab，且停在「任务」
- **AND** 顶栏不再有「管理」下拉或右滑抽屉

#### Scenario: 切换 Tab

- **WHEN** 用户点击「工作流」Tab
- **THEN** 展示货架 surface，且顶栏搜索框出现
- **WHEN** 用户点击「Daemon」Tab
- **THEN** 展示 Daemon 操作面（连接状态 / 常用交付路径 / 材料提示 / 管线记录），搜索框隐藏
- **AND** 只读专家阵容不以主屏墙展示，但可展开查看

## ADDED Requirements

### Requirement: Daemon 常用交付路径

Daemon Tab SHALL 将远程 workflow 策展为常用路径：`catalog.visibility=primary` 按 `order` 至多展示 4 条；其余用户可见路径收入「更多路径」。每条路径 SHALL 展示结果导向说明与开工入口，MUST NOT 默认展开完整专家阵容。

#### Scenario: 首屏常用路径

- **WHEN** Daemon 在线且存在不少于一条 primary workflow
- **THEN** 左栏至多展示 4 条常用路径
- **AND** 超出或 advanced 路径可经「更多路径」展开

#### Scenario: 选择路径查看详情

- **WHEN** 用户选中一条路径
- **THEN** 中栏展示结果说明、短阶段条、材料体检与开工按钮
- **AND** 「团队构成」默认折叠，展开后可见只读专家列表

### Requirement: Daemon 材料体检（软门禁）

选中路径后，Daemon 面 SHALL 展示材料体检清单（需求说明、资源、连接状态等）。Daemon 离线或路径 locked 时 MUST 禁用开工；材料缺失 MUST 警告但 MAY 仍允许开工。

#### Scenario: 离线硬阻拦

- **WHEN** Daemon 离线
- **THEN** 开工按钮禁用，并提示连接状态

#### Scenario: 材料缺失软提醒

- **WHEN** Daemon 在线且路径未 locked，但本地未保存 PRD/需求路径
- **THEN** 材料体检标记需求说明缺失或建议补充
- **AND** 开工按钮仍可用（除非另有硬阻拦）

### Requirement: Daemon 管线记录

Daemon Tab 右侧 SHALL 展示「管线记录」（仅 Daemon runs），标题优先使用 intent；每条 SHALL 给出状态与下一动作提示。界面文案 MUST NOT 将 Daemon runs 称为与顶栏「任务」Tab 同一概念的「任务」。

#### Scenario: 记录人话化

- **WHEN** 存在带 intent 的 Daemon run
- **THEN** 记录条目主标题为 intent，不以 slug 作为唯一可见标题

#### Scenario: 筛选需要你处理

- **WHEN** 用户选择「需要你」筛选
- **THEN** 仅展示等待门禁、澄清或失败需处理的记录

### Requirement: Daemon 运行审阅优先

打开 Daemon 管线运行详情时，界面 SHALL 优先呈现进度、需要你处理的动作与产物；参与专家列表与原始运行日志默认折叠，用户可展开。

#### Scenario: 默认折叠日志与阵容

- **WHEN** 用户打开一条 Daemon 管线记录进入运行页
- **THEN** 可见当前状态 / 下一步 / 产物区域
- **AND** 运行日志默认不抢占主视野（折叠或收起）
- **AND** 参与专家区域默认折叠或置于次要位置
