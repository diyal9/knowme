## ADDED Requirements

### Requirement: Step skills are configurable inside the studio

编排的步骤检查器 MUST 允许直接为当前步骤选择技能，选中结果 MUST 写入该节点 profile 的 `skillRefs`，并 MUST 在保存工作流时随节点一起持久化。步骤卡片上的技能计数 MUST 与选择结果保持同步。当没有可选技能时 MUST 显示说明文案与前往能力界面的入口，MUST NOT 只留空白。检查器内的技能选择 MUST NOT 要求用户离开当前草稿。

#### Scenario: Bind a skill to a step without leaving the draft

- **WHEN** 用户在步骤检查器中勾选一项技能
- **THEN** 该步骤卡片显示的技能数量立即更新
- **AND** 草稿状态标记为有未保存修改，用户仍停留在编排页

#### Scenario: Skill selection survives save and reload

- **WHEN** 用户勾选技能后保存工作流，并重新打开这条工作流
- **THEN** 该步骤的技能勾选状态与保存前一致

#### Scenario: No installed skills

- **WHEN** 本地没有任何可选技能
- **THEN** 检查器的技能区显示说明文案与前往能力界面的入口

### Requirement: Unsaved studio drafts are protected

当编排草稿存在未保存修改时，返回货架、切换到另一条已保存工作流、切换工作台顶栏 Tab MUST 先请求确认。确认 MUST 提供「保存后离开」「放弃修改」「取消」三种结果：保存后离开 MUST 等价于执行保存流程（校验失败时留在原地），放弃修改 MUST 直接离开且丢弃草稿，取消 MUST 留在原地且草稿内容不变。草稿没有未保存修改时 MUST NOT 打断用户。

#### Scenario: Leaving with unsaved changes

- **WHEN** 用户修改草稿后点击「返回货架」
- **THEN** 出现确认，提供保存后离开、放弃修改与取消

#### Scenario: Cancel keeps the draft intact

- **WHEN** 用户在离开确认中选择「取消」
- **THEN** 仍停留在编排页，草稿的步骤、参数与选择保持不变

#### Scenario: Clean draft does not prompt

- **WHEN** 草稿没有未保存修改且用户点击「返回货架」
- **THEN** 直接返回货架，不出现确认

### Requirement: Studio remains usable on narrow windows and via keyboard

步骤检查器 MUST 在所有窗口宽度下可见：宽窗作为侧栏，窄窗折到主区下方，MUST NOT 存在任何宽度区间使检查器被隐藏。步骤卡片 MUST 可通过键盘聚焦，并 MUST 提供与拖拽等价的键盘排序方式；排序完成后焦点 MUST 仍在被移动的步骤上。

#### Scenario: Inspector stays visible while resizing

- **WHEN** 窗口宽度在 1000px 到 1200px 之间连续变化
- **THEN** 步骤检查器始终可见，只在侧栏与下方两种布局间切换

#### Scenario: Reorder a step with the keyboard

- **WHEN** 用户用键盘聚焦到某个步骤并按下排序快捷键
- **THEN** 该步骤与相邻步骤交换位置
- **AND** 焦点仍停留在被移动的步骤上
