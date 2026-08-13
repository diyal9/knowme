## Purpose

定义 KnowMe 工作台壳层中可读的左侧主导航和扁平的页面标签，使用户在固定窗口尺寸内能够快速识别入口、确认当前位置并可靠切换页面。

## ADDED Requirements

### Requirement: Left rail exposes labeled navigation

工作台左侧主导航 MUST 以图标和中文文字共同呈现可用入口，并 MUST 保留原有入口顺序、功能和分组。

#### Scenario: User views the primary navigation

- **WHEN** 用户打开 KnowMe 工作台
- **THEN** 左侧主导航中的业务入口同时显示图标和名称
- **AND** 办公助理入口使用“助理”作为紧凑可见标签，并保留完整无障碍名称
- **AND** 当前入口具有区别于悬停状态的清晰激活反馈

#### Scenario: User operates navigation by keyboard

- **WHEN** 用户使用键盘聚焦左侧主导航入口
- **THEN** 聚焦入口显示可感知的焦点样式
- **AND** 激活入口触发的页面与改版前一致

### Requirement: Wider rail preserves the fixed window composition

左侧主导航加宽后 MUST 在现有 Electron 窗口宽度内重新分配空间，MUST NOT 扩大窗口外框；覆盖工作区的页面 MUST 从主导航右缘开始。

#### Scenario: Rail is rendered in the default window

- **WHEN** 工作台以默认窗口尺寸显示
- **THEN** 窗口外框宽度保持不变
- **AND** 主内容区在剩余空间内自然收缩且无横向遮挡

#### Scenario: User opens a center-surface overlay

- **WHEN** 用户从左侧主导航打开能力 Hub 或其他中心覆盖层
- **THEN** 覆盖层左边缘与主导航右边缘对齐
- **AND** 覆盖层不遮挡主导航且两者之间无可见空隙

### Requirement: Workbench page tabs use a flat active indicator

工作台页面切换 MUST 使用无胶囊容器底色的扁平文字标签，并 MUST 通过底部线条标识当前页面，同时保留现有页面切换和隐藏规则。

#### Scenario: User views workbench home

- **WHEN** 用户进入工作台首页
- **THEN** “首页”和“工作流”以扁平文字标签显示
- **AND** “首页”下方显示激活线条
- **AND** 标签组不显示包裹全部标签的胶囊边框、底色或阴影

#### Scenario: User switches workbench page

- **WHEN** 用户点击“工作流”标签
- **THEN** 工作流页面成为当前页面
- **AND** 激活线条移动到“工作流”标签下方
- **AND** 键盘语义与页面切换逻辑保持可用

#### Scenario: Tabs are hidden in focused task states

- **WHEN** 用户进入任务工作间、自动化模式或运行器聚焦状态
- **THEN** 工作台页面标签继续按现有规则隐藏

### Requirement: Detail chrome avoids duplicate module branding

左侧主导航已显示当前模块名称时，内容区顶栏 MUST NOT 再显示相同模块的图标和名称；页面级标签、上下文标题和必要操作 MUST 保持可用。

#### Scenario: User opens workbench or automation

- **WHEN** 用户从左侧主导航进入工作台或自动化
- **THEN** 内容顶栏不再重复显示“工作台”或“自动化中心”的模块图标与名称
- **AND** 工作台页面标签、刷新操作及正文内的页面标题保持可用

#### Scenario: User opens capability hub

- **WHEN** 用户从左侧主导航进入能力 Hub
- **THEN** Hub 顶栏不再重复显示“能力 Hub”图标与名称
- **AND** 专家、技能、MCP 连接器以无胶囊容器底色的扁平文字标签显示
- **AND** 当前能力类型通过底部线条标识，MUST NOT 使用绿色实心激活块
- **AND** 标签切换与关闭操作保持可用

#### Scenario: User opens knowledge or settings

- **WHEN** 用户从左侧主导航进入知识库或设置
- **THEN** 覆盖层顶栏不再重复显示“知识库”或“设置”的模块名称
- **AND** 关闭操作及内容区自身的上下文标题保持可用

#### Scenario: User enters a workbench task room

- **WHEN** 用户在工作台进入任务工作间
- **THEN** 协作对话栏不再重复显示“工作台”品牌标题
- **AND** 对话内容与输入控件保持可用
