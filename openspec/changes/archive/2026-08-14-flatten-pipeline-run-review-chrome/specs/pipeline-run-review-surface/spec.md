## ADDED Requirements

### Requirement: Review chrome stays flat and title-unique

管线审阅右栏 MUST 采用与工作台「项目配置」侧栏同级的浅色扁平层次（白/浅底 + 细边卡片），MUST NOT 再叠加深米色渐变外壳制造多层装饰嵌套。工作流名称 MUST 仅在运行顶栏身份区出现一次；daemon 审阅态 MUST NOT 再在 runner 头或审阅大标题中重复同一名称。审阅主标题若保留，MUST 为紧凑 panel 级文案（如「审阅」），MUST NOT 使用压过顶栏的大标题字号。

#### Scenario: Flat review surface

- **WHEN** 用户打开 Daemon 管线执行间右栏
- **THEN** 审阅区为浅色扁平布局，无明显的深米色多层套壳
- **AND** 顶栏工作流名旁可见结论 pill，其下不重复同一工作流名副行（或副行仅为进度摘要且与标题不同文）

#### Scenario: No oversized review hero title

- **WHEN** 审阅 Tab 可见
- **THEN** 不出现与顶栏抢层级的「审阅 制品」类大标题，或仅保留紧凑 panel 标题

### Requirement: Code workspace entry is honest

「代码工作区」入口 MUST 仅在存在可打开的本地路径（如本地制品路径）时可用，并调用既有打开能力。无可用路径时 MUST 隐藏或禁用该入口。MUST NOT 弹出「后续接入 API」类占位提示，也 MUST NOT 用假动作冒充已打开工作区。

#### Scenario: Open local artifact path

- **WHEN** 当前运行至少有一条可打开的本地制品路径，且用户点击「代码工作区」
- **THEN** 系统尝试打开该路径（或其所在目录）
- **AND** 不出现「后续接入 API」提示

#### Scenario: No path hides or disables entry

- **WHEN** 当前运行没有可打开的本地路径
- **THEN** 「代码工作区」按钮隐藏或禁用
- **AND** 点击路径不存在时不会弹出占位 API toast
