## MODIFIED Requirements

### Requirement: Session creation and closing

工作台 MUST 支持从顶栏创建和关闭 Session，并在无打开 Session 时保证始终有一个可用的空白 Session。渲染层 MUST 采纳主进程在关空打开集合时新建 Session 的结果，MUST NOT 用关前 Tab 集合覆盖该结果。

#### Scenario: Create a blank session

- **WHEN** 用户点击右侧 `+`
- **THEN** 创建全新空白 Session，加入打开 Tab 并激活
- **AND** 其他 Tab 的历史消息保持不变

#### Scenario: Ensure one session exists

- **WHEN** 用户打开工作台且没有任何 Session，或打开 Tab 集合为空
- **THEN** 自动创建并激活一条空白 Session

#### Scenario: Close a tab without deleting session

- **WHEN** 用户点击 Tab 上的 `×`
- **THEN** 该 Session 从打开 Tab 移除，但磁盘中的 Session 数据仍保留
- **AND** 若关闭的是激活 Tab，则激活相邻 Tab；若无相邻 Tab 则自动新建一个

#### Scenario: Close the last open tab opens a fresh blank session

- **WHEN** 助理顶栏仅剩一个打开 Tab，用户点击其关闭 `×`
- **THEN** 该 Tab 从打开集合消失
- **AND** 自动出现并激活一个新的空白 Session Tab（标题为默认新对话文案）
- **AND** 渲染层 MUST NOT 继续展示被关闭的那个 Tab 冒充「关不掉」

## ADDED Requirements

### Requirement: Session tab close chrome parity

激活 Session Tab MUST 常显关闭 `×`（无需悬停才出现）；关闭控件视觉 MUST 与工作台其它关闭钮同族（小尺寸、浅 hover 底、非大圆斑），Tab 列表 MUST 贴齐助理顶栏左缘。

#### Scenario: Active tab close is always visible

- **WHEN** 某 Session Tab 为激活态
- **THEN** 关闭 `×` 在未悬停时也可见且可点

#### Scenario: Tab strip aligns to content left edge

- **WHEN** 用户查看助理顶栏
- **THEN** 首个 Session Tab 左缘与助理内容区顶栏左缘对齐，无额外明显缩进
