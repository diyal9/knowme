## Purpose

为 KnowMe 各页面中的临时详情、预览与确认操作提供一致的居中二级弹窗体验，统一信息层级、滚动边界、响应式布局和可预期的关闭方式。

## ADDED Requirements

### Requirement: Secondary dialogs open centered in the active viewport

系统 SHALL 将临时详情、预览与确认层显示为当前视窗居中的二级弹窗，并 SHALL NOT 使用从右侧、左侧或底部滑入的侧滑框动效。

#### Scenario: Open a secondary detail

- **WHEN** 用户从当前页面打开能力详情、版本记录或提示词预览
- **THEN** 二级弹窗在当前视窗水平与垂直方向居中显示
- **AND** 背景页面由遮罩保持可识别但不可误操作

#### Scenario: Preserve primary surfaces

- **WHEN** 用户打开设置、知识库或能力中心等一级页面
- **THEN** 系统继续使用对应的整页承载方式
- **AND** 一级页面不因二级弹窗规范而缩成模态卡片

### Requirement: Secondary dialogs share predictable structure and dismissal

二级弹窗 MUST 使用一致的标题栏、右上角关闭按钮、独立内容滚动区与可选底部操作区，并 MUST 支持关闭按钮、Escape 和遮罩点击关闭；需要用户明确选择的高风险确认流程 MAY 禁止遮罩关闭。

#### Scenario: Close a standard secondary dialog

- **WHEN** 用户点击关闭按钮、按下 Escape 或点击标准二级弹窗遮罩
- **THEN** 当前二级弹窗关闭
- **AND** 用户返回触发弹窗前的页面上下文

#### Scenario: Scroll long dialog content

- **WHEN** 二级弹窗内容高度超过当前视窗可用空间
- **THEN** 仅内容区域纵向滚动
- **AND** 标题栏、关闭入口与主要底部操作保持可达

### Requirement: Secondary dialogs adapt without horizontal overflow

二级弹窗 MUST 在桌面宽窗与窄窗中保留安全边距并按可用空间收缩，内容 MUST NOT 产生页面级横向滚动。

#### Scenario: Open dialog in a narrow window

- **WHEN** 当前视窗宽度小于弹窗首选宽度
- **THEN** 弹窗宽度缩小到视窗安全边距内
- **AND** 多列内容按场景重排为单列且核心操作保持可见
