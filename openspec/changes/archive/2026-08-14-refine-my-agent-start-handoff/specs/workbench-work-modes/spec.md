## MODIFIED Requirements

### Requirement: My-agent tab shows agents and personal workflows

`我的 Agent` Tab MUST 同时呈现两类内容：用户的本地 Agent（可编辑、非 Daemon）与用户的个人 / 派生工作流。本地 Agent 卡片 MUST 提供「开始使用」与「调优」两个操作。个人工作流卡片沿用货架卡片契约（开始 / 编辑）。

Agent 卡片 MUST 呈现可识别的身份标记（按角色语义取图标）与职责说明，MUST NOT 直出 emoji 作为头像。卡片 SHOULD 呈现绑定能力规模（技能 / 连接器数量）以便用户在启动前判断该 Agent 的能力面。

#### Scenario: Local agents are listed

- **WHEN** 用户处于「我的 Agent」Tab 且存在本地可编辑 Agent
- **THEN** 每个本地 Agent 显示为一张卡片，提供「开始使用」与「调优」操作
- **AND** 卡片显示该 Agent 的图标标记与职责说明，不出现 emoji 头像

#### Scenario: Tune routes to the agent editor

- **WHEN** 用户点击某个 Agent 卡片的「调优」
- **THEN** 系统进入该 Agent 的编辑面板（智能体管理），定位到该 Agent

#### Scenario: Start routes to a conversation

- **WHEN** 用户点击某个 Agent 卡片的「开始使用」
- **THEN** 系统以该 Agent 开启一个助理对话，不新建第二个独立对话场所

## ADDED Requirements

### Requirement: Agent start action reports progress and stays recoverable

「开始使用」会跨进程创建会话，属于异步操作。该操作 MUST 在等待期间进入可见的 pending 态并阻止同一 Agent 被重复触发；MUST NOT 在失败后留下不可点击的按钮或无下一步的死入口。失败反馈 MUST 只出现一条，MUST NOT 由货架与助理侧各弹一次。

#### Scenario: Pending state blocks duplicate launches

- **WHEN** 用户点击某个 Agent 卡片的「开始使用」且会话尚未创建完成
- **THEN** 该按钮显示等待态文案并变为不可点击
- **AND** 在此期间对同一 Agent 的重复点击不会创建第二个会话

#### Scenario: Failed start restores the card

- **WHEN** 会话创建失败（助理模块不可用、Agent 定义加载失败或助手正在生成）
- **THEN** 按钮恢复为可点击的「开始使用」
- **AND** 用户仍留在工作台，并收到一条说明原因且指向下一步的提示

### Requirement: Agent card exposes accessible interaction states

Agent 卡片的操作 MUST 提供键盘可见的焦点态，SHOULD 提供按压反馈。所有位移与循环动效 MUST 在 `prefers-reduced-motion: reduce` 下关闭，且 MUST NOT 通过动画 `width` / `height` / `top` / `left` 实现。

#### Scenario: Keyboard focus is visible

- **WHEN** 用户用键盘将焦点移到卡片上的「开始使用」或「调优」
- **THEN** 该按钮显示可见的焦点环

#### Scenario: Reduced motion is respected

- **WHEN** 系统开启「减少动态效果」
- **THEN** 卡片的悬停位移、按压位移与等待态脉冲不产生动画
