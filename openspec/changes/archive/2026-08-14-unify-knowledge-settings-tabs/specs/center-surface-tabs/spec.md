## Purpose

定义 KnowMe 知识库与设置中心面板的一致一级导航，使用户能在固定桌面窗口内识别当前位置、可靠切换页面，并保留各页面已有业务能力。

## ADDED Requirements

### Requirement: Center surfaces use consistent primary tabs

知识库与设置中心面板 MUST 在顶栏使用扁平文字标签和激活下划线呈现一级页面导航，MUST NOT 显示胶囊容器、实心激活块或重复模块标题。

#### Scenario: User opens knowledge

- **WHEN** 用户从左侧主导航打开知识库
- **THEN** 顶栏显示“浏览 / 知识源 / 知识体检”
- **AND** “浏览”默认激活并通过底部线条标识
- **AND** 内容区不重复显示“知识库”模块标题

#### Scenario: User opens settings

- **WHEN** 用户从左侧主导航打开设置
- **THEN** 顶栏显示“内容源 / AI 接口 / 助手模式 / 系统配置 / 连接器 / 我的记忆 / 关于”
- **AND** “内容源”默认激活并通过底部线条标识
- **AND** 内容区不再显示第二套设置标题或标签栏

### Requirement: Knowledge tabs expose existing workflows

知识库一级标签 MUST 分别提供现有浏览、知识源管理和知识体检能力，切换页面 MUST NOT 改变知识数据、来源配置或体检语义。

#### Scenario: User switches knowledge page

- **WHEN** 用户点击“知识源”或“知识体检”
- **THEN** 内容区显示对应知识源管理页或体检结果页
- **AND** 顶栏仅将所选标签标记为激活
- **AND** “全部 / 资料 / 已整理”继续仅作为浏览页二级筛选

#### Scenario: User returns to browsing

- **WHEN** 用户从其他知识页点击“浏览”
- **THEN** 内容区恢复知识条目浏览与阅读能力
- **AND** 当前知识源和已有数据保持不变

### Requirement: Settings shell and iframe stay synchronized

设置中心面板顶栏与嵌入设置内容 MUST 对当前分类使用同一状态，且消息同步 MUST 仅接受当前设置 iframe。

#### Scenario: User switches settings category

- **WHEN** 用户点击设置顶栏中的分类标签
- **THEN** 嵌入内容切换到对应设置面板
- **AND** 顶栏标签的激活状态与内容分类一致
- **AND** 现有表单、保存与取消行为保持可用

#### Scenario: Embedded settings reports its category

- **WHEN** 当前设置 iframe 加载或选择有效分类
- **THEN** 父级顶栏同步 `aria-selected` 与激活下划线
- **AND** 来自非当前设置 iframe 的同类消息被忽略

### Requirement: Center-surface tabs remain accessible and responsive

中心面板标签 MUST 使用正确的 tab 语义和清晰的 hover、focus、pressed 状态；在最小支持窗口下 MUST 保持关闭操作可见，并允许标签区域水平滚动。

#### Scenario: User navigates tabs by keyboard

- **WHEN** 用户将键盘焦点置于知识库或设置标签
- **THEN** 焦点样式清晰可见
- **AND** 激活标签具有 `aria-selected="true"`
- **AND** 对应内容区具有可关联的 `tabpanel` 语义

#### Scenario: Window is narrow

- **WHEN** 中心面板以最小支持宽度显示且所有设置标签无法同时容纳
- **THEN** 标签区域可水平滚动且标签不折行
- **AND** 关闭按钮保持可见并可操作
