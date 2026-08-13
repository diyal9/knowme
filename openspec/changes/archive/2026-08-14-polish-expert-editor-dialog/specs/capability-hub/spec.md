## ADDED Requirements

### Requirement: Expert editor dialog is grouped and scannable

专家编辑弹窗（新建 / 调优 / 复制为自建）MUST 将表单拆分为带标题与说明的分组，正文 MUST 与标题栏、底栏保持同一左缘。Skill、Tool（连接器）与知识库范围 MUST 以响应式多列卡片式多选呈现，并提供常态、悬停、键盘聚焦与选中的可区分状态。每个多选分组 MUST 显示已选数量与总数，并提供全选与清空操作；弹窗底栏 MUST 常驻已选摘要且随勾选实时更新。必填字段 MUST 有必填标识，校验失败时 MUST 高亮并聚焦该字段。

当某个多选分组的候选项超过可一屏扫描的数量时，该分组 MUST NOT 将全部候选项平铺展开：MUST 按分类分组、限制列表高度并在分组内滚动，同时 MUST 提供组内搜索与「仅看已选」复核方式；此时全选与清空 MUST 只作用于当前可见（已筛选）的候选项。

#### Scenario: Configure an expert in a desktop window

- **WHEN** 用户在桌面宽度下打开「添加自己的专家」
- **THEN** 表单按基础信息、Skills、Tool 与连接器、知识库范围分组展示，分组之间有可见分隔
- **AND** 三处多选以多列卡片排布，正文与标题栏、底栏左缘对齐且无横向溢出

#### Scenario: Selection stays visible while scrolling

- **WHEN** 用户勾选若干 Skill 或连接器后继续向下滚动
- **THEN** 对应分组标题显示的已选 / 总数随勾选更新
- **AND** 底栏摘要持续显示当前已选的 Skill、Tool 与知识源数量

#### Scenario: Bulk select within a group

- **WHEN** 用户在某个多选分组点击「全选」或「清空」
- **THEN** 该分组内所有选项同步为选中或未选中
- **AND** 分组计数与底栏摘要立即反映变化

#### Scenario: Required field validation

- **WHEN** 用户在专家 ID 或名称为空时点击保存
- **THEN** 保存被阻止并提示需要填写
- **AND** 缺失的字段被高亮并获得输入焦点

#### Scenario: Large skill catalog stays scannable

- **WHEN** 用户打开的专家编辑弹窗中已安装的 Skill 数量远超一屏可扫描的数量
- **THEN** Skills 分组按分类分节并限制自身高度，其后的 Tool 与知识库分组仍在同屏可见
- **AND** 用户可在组内搜索关键词，仅命中项保留显示，无命中时给出提示

#### Scenario: Review and bulk-apply within a filtered group

- **WHEN** 用户在某个大列表分组中输入搜索词后点击「全选」
- **THEN** 仅当前可见的命中项被选中，未显示的候选项保持原状
- **AND** 用户开启「仅看已选」后可只看到该分组当前已选的项

#### Scenario: Empty capability catalog

- **WHEN** 用户尚未安装 Skill、连接器或知识来源
- **THEN** 对应分组显示统一的占位提示而非空白区域
- **AND** 其余分组仍可正常配置与保存
