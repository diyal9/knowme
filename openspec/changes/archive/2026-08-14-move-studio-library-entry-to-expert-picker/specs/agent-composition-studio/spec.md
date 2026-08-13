## MODIFIED Requirements

### Requirement: Studio expert picker hosts capability library entry

编排 Studio 左侧组件栏 MUST NOT 再提供独立「库」按钮。用户点击调色板「专家」后打开的「选择工作台专家」二级弹窗 MUST 提供带专家库图标与「专家库」文字的入口按钮。点击该入口 MUST 打开专家库以便将专家「添加到工作台」；关闭专家库后 MUST 自动回到该选择弹窗，并展示刷新后的工作台专家列表供直接多选加入画布。

#### Scenario: Library entry lives in expert picker

- **WHEN** 用户在专业画布组件栏查看标题区
- **THEN** 不得出现「库」快捷按钮；点「专家」打开选择弹窗后 MUST 可见「专家库」图标+文字按钮

#### Scenario: Return from library resumes picker

- **WHEN** 用户从选择弹窗进入专家库并将专家添加到工作台后关闭专家库
- **THEN** 系统 MUST 重新打开「选择工作台专家」弹窗，且列表包含新绑定的专家
