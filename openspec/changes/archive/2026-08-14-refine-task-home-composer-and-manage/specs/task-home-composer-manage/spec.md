## Purpose

工作台任务首页的新建任务弹窗体验与最近任务批量管理，替代原定时任务入口，让用户更快开任务并清理列表。

## ADDED Requirements

### Requirement: Hide schedule hub entry on task home

任务首页「最近任务」区域 MUST NOT 展示「定时任务」文案或打开定时管理弹窗的入口。

#### Scenario: Recent tasks header uses manage control

- **WHEN** 用户查看任务首页最近任务区
- **THEN** 可见设置类图标入口用于管理最近任务，且不可见「定时任务」标签

### Requirement: Batch manage recent expert tasks

用户 MUST 能从最近任务管理弹窗勾选一条或多条专家任务并批量删除（归档），列表与首页同步刷新。

#### Scenario: Batch archive selected tasks

- **WHEN** 用户打开管理弹窗、勾选至少一条任务并确认删除
- **THEN** 系统归档所选任务并从最近任务列表移除

#### Scenario: Empty selection cannot delete

- **WHEN** 用户未勾选任何任务点击删除
- **THEN** 系统不归档任务并提示先选择

### Requirement: Task composer chrome

「安排专家执行任务」弹窗 MUST 在右上提供关闭控件，MUST NOT 提供「取消」按钮，主操作「创建并开始」MUST 位于操作区右侧。

#### Scenario: Close via header control

- **WHEN** 用户点击弹窗右上关闭
- **THEN** 弹窗关闭且不创建任务

### Requirement: Expert picker brief cards

专家选择控件 MUST 以简要专家卡片（头像 + 名称，可选一行角色/摘要）展示可选与已选专家，不得仅用纯文本原生下拉。

#### Scenario: Open picker shows avatars

- **WHEN** 用户展开选择专家
- **THEN** 每个选项显示头像与名称

### Requirement: Task knowledge options readable

任务知识库选项 MUST 保持复选框与标签对齐、文字可读，不得因父级表单样式把复选框拉伸为整行宽。

#### Scenario: Knowledge option layout

- **WHEN** 新建任务弹窗展示至少一个知识库选项
- **THEN** 复选框为紧凑控件，名称与状态文案同卡内清晰排列
