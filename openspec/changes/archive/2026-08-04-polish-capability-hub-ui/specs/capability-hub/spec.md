## MODIFIED Requirements

### Requirement: Hub browse layout matches curated store pattern

Capability Hub MUST 为专家、技能和 MCP 连接器提供统一的 KnowMe 浅色暖灰视觉系统。页面 MUST 包含清晰的页面标题与当前类型说明、顶部搜索、同页类型 Tab、分类筛选、已安装筛选、可选精选区、响应式能力目录和右侧详情抽屉；在桌面常见窗口宽度下 MUST 保持可扫描的信息层级且不产生横向溢出。可交互元素 MUST 提供悬停、按压与键盘焦点反馈，目录加载、无结果及错误 MUST 显示与页面结构匹配的状态。

#### Scenario: Search filters cards

- **WHEN** 用户在 Hub 搜索框输入关键词
- **THEN** 当前 Tab 下卡片列表按名称/描述/标签过滤
- **AND** 无匹配时显示带清除筛选或添加能力引导的空状态

#### Scenario: Category chip filters

- **WHEN** 用户点击某分类筛选（如「写作」「飞书」）
- **THEN** 卡片列表仅显示该分类条目
- **AND** 当前分类具有可感知的选中态

#### Scenario: Installed filter

- **WHEN** 用户开启「已安装」筛选
- **THEN** 仅显示 install store 中 status 为 installed/enabled/disabled 的条目
- **AND** 筛选状态在视觉与无障碍状态上均可识别

#### Scenario: Card opens detail drawer

- **WHEN** 用户点击或通过键盘激活某能力卡片
- **THEN** 右侧抽屉展示描述、版本、来源、依赖、启用开关与安装/更新/卸载操作
- **AND** 抽屉与当前目录保持一致的主题和信息层级

#### Scenario: Catalog is loading

- **WHEN** 当前 Tab 的能力目录正在加载
- **THEN** 页面显示与精选区及能力卡片形状匹配的骨架占位
- **AND** 不显示会被误认为真实能力的旧目录内容

#### Scenario: Catalog load fails

- **WHEN** 能力目录请求失败且没有可展示的回退条目
- **THEN** 页面显示可读错误说明与重试操作
- **AND** 错误状态不破坏页面布局或关闭入口

#### Scenario: Hub adapts to window width

- **WHEN** Hub 宽度从宽桌面缩小到窄桌面窗口
- **THEN** 标题、搜索、类型 Tab、筛选和能力目录按可用空间重排
- **AND** 页面不产生横向滚动，核心操作保持可见
