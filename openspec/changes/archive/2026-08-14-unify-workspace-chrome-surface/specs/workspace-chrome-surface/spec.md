## Purpose

定义 KnowMe 工作台窗口壳层的产品品牌展示，以及助理、工作台与中心覆盖层在内容岛背景色和左上圆角上的一致性，保证模块切换时视觉连续。

## ADDED Requirements

### Requirement: Titlebar shows KnowMe product brand

在使用隐藏系统标题的工作台窗口中，顶栏拖拽区 MUST 显示 KnowMe 品牌图标与「KnowMe」标题；MUST NOT 遮挡系统窗口控制按钮，且 MUST 保持窗口可拖动。

#### Scenario: Brand visible on workspace open

- **WHEN** 用户打开 KnowMe 工作台窗口
- **THEN** 顶栏可见品牌图标与「KnowMe」文案
- **AND** 拖动顶栏空白区域仍可移动窗口

#### Scenario: Brand does not block window controls

- **WHEN** 用户点击最小化 / 最大化 / 关闭
- **THEN** 系统窗口按钮仍可正常使用，不被品牌层拦截

### Requirement: Content island background matches assistant

助理、工作台与自动化模式的外层内容岛背景 MUST 使用同一内容区底色（与助理界面一致）；MUST NOT 在模块切换时出现明显的灰/白画布跳变。

#### Scenario: Workbench matches assistant canvas

- **WHEN** 用户从助理切换到工作台
- **THEN** 内容区外层背景色与助理内容区一致
- **AND** 内部任务卡片等 surface 仍可有边框与局部底色区分层级

### Requirement: Content island top-left radius is unified

主内容岛与从左侧 rail 打开的中心覆盖层（知识网、设置等）MUST 使用同一左上圆角；MUST NOT 在覆盖层上使用与主岛冲突的直角切角。

#### Scenario: Center surface matches main radius

- **WHEN** 用户从左侧导航打开知识网或设置覆盖层
- **THEN** 覆盖层左上圆角与助理/工作台主内容岛一致
- **AND** 覆盖层外层背景与内容岛底色一致
