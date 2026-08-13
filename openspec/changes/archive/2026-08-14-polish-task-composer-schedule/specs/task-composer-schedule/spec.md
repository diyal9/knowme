## ADDED Requirements

### Requirement: Compact task knowledge options

「安排专家执行任务」弹窗中的任务知识库选项 MUST 以紧凑行展示（勾选 + 名称 + 来源说明），MUST NOT 因父级表单样式把复选框拉伸为整行宽，且 MUST NOT 在少量选项时留下大块无意义空白。

#### Scenario: Single local knowledge option

- **WHEN** 用户打开新建任务弹窗且仅有一个知识库提供方
- **THEN** 选项以紧凑行呈现，说明文案紧跟其下，主操作按钮上方无大段空心区域

### Requirement: Fresh composer goal is empty

从任务首页「+ 新建任务」打开弹窗时，任务目标 MUST 默认为空，MUST NOT 回填会话级 `pendingGoal` 或其它界面残留文案。

#### Scenario: New task ignores stale pending goal

- **WHEN** 会话中曾有目标文案（如管线侧「三元礼包」）残留在 `pendingGoal`
- **AND** 用户点击「+ 新建任务」
- **THEN** 任务目标输入框为空，占位符提示用户填写

#### Scenario: Explicit goal still prefills

- **WHEN** 调用方显式传入 `goal`（如从已有任务再次安排）
- **THEN** 任务目标输入框预填该 `goal`

### Requirement: Optional schedule on create

新建专家任务弹窗 MUST 提供可选定时设置（每天 / 间隔 / 单次）。用户开启并「创建并开始」后，系统 MUST 立即开工，并 MUST 将计划持久化到该任务；UI MUST 提示仅本机 App 在线时触发。

#### Scenario: Enable daily schedule on create

- **WHEN** 用户开启定时、选择每天时刻并创建并开始
- **THEN** 任务立即进入专家执行，且任务持久化 `scheduleEnabled=true`、可读 `scheduleLabel` 与未来的 `nextRunAt`

#### Scenario: Schedule off by default

- **WHEN** 用户打开新建任务弹窗且未开启定时
- **THEN** 创建的任务 `scheduleEnabled=false`，且不展示频率时间控件
