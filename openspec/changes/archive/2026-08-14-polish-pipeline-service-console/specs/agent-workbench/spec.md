# agent-workbench (delta)

## MODIFIED Requirements

### Requirement: Daemon 常用交付路径

Daemon Tab SHALL 将远程 workflow 策展为常用路径：`catalog.visibility=primary` 按 `order` 至多展示 4 条；其余用户可见路径收入「更多路径」。路径列表 SHALL 以**路径名称**为主交互标签，MUST NOT 在列表中默认铺满多行说明书式摘要。中栏 MUST 提供开工主操作；结果说明与阶段信息 MUST 精简（一句话或阶段条），MUST NOT 默认展开完整专家阵容。

#### Scenario: 首屏常用路径

- **WHEN** Daemon 在线且存在不少于一条 primary workflow
- **THEN** 左栏至多展示 4 条常用路径（名称主导）
- **AND** 超出或 advanced 路径可经「更多路径」展开

#### Scenario: 选择路径后可操作

- **WHEN** 用户选中一条路径
- **THEN** 中栏展示路径名、精简阶段条、材料就绪状态与开工按钮
- **AND** 「团队构成」默认折叠

### Requirement: Daemon 操作面信息层次

Daemon Tab 首屏 MUST NOT 重复展示与顶栏「管线服务」同名的页级大标题。连接状态 SHALL 以可操作状态条呈现（在线/离线；支持刷新检测）。材料信息 SHALL 以紧凑就绪态呈现；材料缺失时仍可软开门工，离线或 locked MUST 禁用开工。

#### Scenario: 无重复页头

- **WHEN** 用户停留在顶栏「管线服务」Tab
- **THEN** 内容区不另起与 Tab 同名的主标题行

#### Scenario: 离线硬阻拦

- **WHEN** Daemon 离线
- **THEN** 开工按钮禁用，用户可触发重新检测连接
