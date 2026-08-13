## ADDED Requirements

### Requirement: 过程日志无引导 tip

过程日志 Tab MUST NOT 展示「Agent 全局运行过程…」类顶部引导文案。`projectProcessTranscript` 的 `tip` MUST 为空字符串。

#### Scenario: 打开过程日志无 tip

- **WHEN** 用户打开含运行中或已结束任务的过程日志 Tab
- **THEN** 面板顶部不出现「Agent 全局运行过程」或「请完成待办…」引导行

### Requirement: 过程分区标题为全部过程

过程分区标题 MUST 为「全部过程」。

#### Scenario: 标题文案

- **WHEN** 用户打开过程日志 Tab 且过程分区可见
- **THEN** 分区文件头标题显示「全部过程」

### Requirement: 过程元数据列表无卡片壳

过程 Markdown 预览中，Process / Traces 等列表项（`ul > li`）MUST 以单行 label:content 展示，MUST NOT 使用独立卡片边框与填充背景。

#### Scenario: 元数据单行

- **WHEN** 过程摘要含 `- **workflow**: \`daemon-stage-impl\`` 一类列表项
- **THEN** 该项以单行展示，无圆角卡片边框

#### Scenario: Traces 单行

- **WHEN** 过程摘要含 Traces 下列表项（如 `workflow_trace` 与长 URL）
- **THEN** 该项同样为无卡片壳的单行排版

### Requirement: 全部过程可放大预览

「全部过程」分区标题栏右侧 MUST 提供放大预览图标按钮（MUST NOT 挂在 Markdown 内嵌小节如 Steps 旁）。点击后 MUST 打开居中二级弹窗，展示整块过程摘要（含元数据与表格）；用户可关闭弹窗返回过程日志。无过程摘要内容时 MUST NOT 显示该按钮。

#### Scenario: 放大按钮在标题栏右侧

- **WHEN** 用户打开过程日志 Tab 且「全部过程」有摘要内容
- **THEN** 「全部过程」文件头标题栏右侧显示放大图标，Steps 等内嵌标题旁无放大图标

#### Scenario: 弹窗查看整块过程

- **WHEN** 用户点击「全部过程」标题栏右侧的放大按钮
- **THEN** 居中二级弹窗打开并展示完整过程摘要，关闭后回到过程日志 Tab
