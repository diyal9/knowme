## ADDED Requirements

### Requirement: Expert editor dialog is larger and more refined

专家编辑弹窗（新建 / 编辑 / 复制为自建）MUST 使用比通用导入弹窗更大的工作区宽度与高度，正文 MUST 保持与标题栏、底栏同一左缘，桌面与窄窗口下 MUST NOT 横向溢出。视觉 MUST 延续 KnowMe 暖灰表面、细分割线与圆角控件，不得引入新的色彩体系。

#### Scenario: Open editor on a desktop window

- **WHEN** 用户在桌面宽度下打开「添加自己的专家」或「编辑」
- **THEN** 弹窗宽度明显大于通用导入弹窗，主表单分区在一屏内可扫读基础信息与 Agentic 配置
- **AND** 标题栏、正文、底栏左缘对齐且无横向滚动

### Requirement: AgenticType options are visually separated

AgenticType 选择控件 MUST 在五个模式选项之间显示水平分隔线，打开列表时每个选项可独立扫读。选中值 MUST 写回与现有保存逻辑兼容的模式 id（react / reflection / tool_use / planning / multi_agent）。

#### Scenario: Open AgenticType list

- **WHEN** 用户打开 AgenticType 下拉
- **THEN** 五个模式选项之间有可见横线分割
- **AND** 选择某一项后控件显示对应标签，保存时仍写入该模式 id

### Requirement: Agentic checkboxes align with their labels

Agentic 模式附属的布尔选项（如「允许使用工具」「允许反思修订」以及规划模式的计划确认项）MUST 将勾选框与文字水平同行对齐。勾选框 MUST NOT 被表单输入样式撑满整行或叠在文字上方。

#### Scenario: View ReAct options

- **WHEN** 用户将 AgenticType 设为 ReAct 并查看附属选项
- **THEN** 「允许使用工具」与「允许反思修订」各自为勾选框在左、文字在右的同一行
- **AND** 勾选状态可点击切换且保存写入既有 agenticConfig 字段

### Requirement: Expert avatar picker is a single scrolling row

专家编辑中的头像选择 MUST 以单行横向滚动展示预设，MUST NOT 折成多行网格。界面 MUST NOT 展示「按名称匹配」按钮或自动匹配说明文案。新建专家时 MUST 按名称、职责与已选 Skill 默认选中匹配头像；用户手动点选后 MUST 停止自动改选。

#### Scenario: Browse avatars while creating

- **WHEN** 用户打开新建专家表单
- **THEN** 头像选项排成可左右滑动的单行
- **AND** 看不到「按名称匹配」按钮或匹配说明
- **AND** 默认已选中系统匹配的预设头像

#### Scenario: Manual avatar choice sticks

- **WHEN** 用户在头像行中点选另一张预设后继续改名称
- **THEN** 头像保持用户点选的那一张，不被自动匹配覆盖

### Requirement: Catalog selection uses a reusable picker dialog

Skills、Tool 与连接器、知识库范围的多选 MUST 由同一套可复用选择组件渲染。专家编辑主表单 MUST 只展示已选摘要与打开选择器的入口；完整目录 MUST 在二级弹窗中浏览、搜索、全选、清空与确认。未安装 Skill 时，Skills 区域 MUST 引导用户先安装技能再选择，并提供前往技能页的入口。保存写入的引用列表 MUST 与改造前一致。

#### Scenario: Choose skills in a dialog

- **WHEN** 用户在专家编辑中点击 Skills 的选择入口
- **THEN** 打开独立选择弹窗，列出已安装 Skill 的可勾选卡片
- **AND** 确认后主表单摘要与底栏计数更新为当前已选

#### Scenario: Empty skills catalog guides install-then-select

- **WHEN** 用户打开专家编辑且尚未安装任何 Skill
- **THEN** Skills 区域提示先安装技能再选择
- **AND** 提供前往「技能」页的操作，不展示空白勾选网格

#### Scenario: Picker bulk actions stay scoped

- **WHEN** 用户在选择弹窗中搜索后点击「全选」
- **THEN** 仅当前可见项被选中
- **AND** 未显示的候选项保持原状
