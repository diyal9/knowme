# office-assistant Specification

## Purpose

定义 KnowMe「办公助理」与「研发工作台」的入口区分，以及办公助理内「我的专家」与飞书快捷入口体验。

## Requirements

### Requirement: 区分办公和研发入口

系统 MUST 明确区分面向全员的办公助理和面向研发人员的研发工作台。

#### Scenario: 查看主导航

- **GIVEN** 用户打开 KnowMe 工作台
- **WHEN** 查看左侧主导航
- **THEN** 能看到“办公助理”和“研发工作台”两个明确入口

### Requirement: 选择我的专家

系统 MUST 在办公助理中提供可发现的专家选择入口。

#### Scenario: 查看专家列表

- **GIVEN** 用户处于办公助理
- **WHEN** 点击“我的专家”
- **THEN** 显示可用专家名称和职责说明
- **AND** 当前专家有选中状态

#### Scenario: 切换专家

- **GIVEN** 专家列表已打开
- **WHEN** 用户选择一个专家
- **THEN** 系统创建或切换到该专家对应的 Agent 会话
- **AND** 不删除原有专家会话

### Requirement: 保留飞书快捷入口

系统 MUST 在办公助理空状态保留飞书文档/知识库查询入口。

#### Scenario: 发起飞书查询

- **GIVEN** 用户处于办公助理且没有对话内容
- **WHEN** 点击飞书查询快捷任务
- **THEN** 系统将查询意图发送给当前专家

#### Scenario: 切换快捷操作分类

- **GIVEN** 用户已展开飞书快捷操作面板
- **WHEN** 在不同快捷大类之间切换
- **THEN** 面板保持固定高度，不因子项数量不同导致输入区跳动

### Requirement: 今日优先级快捷入口接地事实

系统 MUST 在办公助理空状态「今日优先级」入口引导 Agent 先调用飞书事实 Workflow，再输出 Top3。

#### Scenario: 点击后先拉事实再排序

- **GIVEN** 用户处于办公助理空状态
- **WHEN** 点击「今日优先级」
- **THEN** 系统发送的意图 MUST 要求调用 `feishu.today_priority`
- **AND** MUST NOT 默认要求用户先填截止时间、影响范围、当前阻塞三项
- **AND** 事实足够时立刻给出最多 3 件事（每项含优先级理由、预计耗时、第一步动作）
- **AND** 仅在事实不足时最多追问 1 句

### Requirement: Writing office partner exposes daily document tasks

系统 MUST 在写作模式空状态提供面向日常办公的文档任务入口，而不是仅提供抽象写作术语。

#### Scenario: View writing home

- **GIVEN** 用户处于写作模式且当前对话为空
- **WHEN** 渲染空状态
- **THEN** 用户能看到“写需求文档”“写办公文档”“按提纲成稿”“排版定稿”四类主任务
- **AND** 每个入口的标题和副标题都直接说明可交付结果

#### Scenario: Run a document task

- **GIVEN** 用户点击任一写作任务入口
- **WHEN** 系统发送意图给当前写作助手
- **THEN** 发送内容 MUST 面向文档任务目标、材料和交付格式
- **AND** MUST NOT 仅表现为提示词改写模板

### Requirement: Writing office partner performs grounded professional polish

写作办公搭档在润色、改写、扩写场景中 MUST 优先结合可用资料源，而不是只做脱离上下文的语言替换。

#### Scenario: Polish a Feishu document with full body

- **GIVEN** 用户提供飞书文档链接
- **WHEN** 系统已成功读取正文
- **THEN** 助手的润色或改写 MUST 基于正文内容执行
- **AND** 输出 SHOULD 保持术语、事实和结构边界

#### Scenario: Polish with knowledge and RAG support

- **GIVEN** 用户的请求涉及专业背景或知识判断
- **WHEN** 本地知识库或远程 RAG 存在命中
- **THEN** 助手 SHOULD 先吸收相关事实再执行润色改写
- **AND** 未命中时必须明确说明，而不是编造背景知识

#### Scenario: Polish with active source materials

- **GIVEN** 当前 active source 来自本地目录、GitLab、GitHub 或网页
- **WHEN** 用户请求围绕该资料继续润色或改写
- **THEN** 助手 MAY 通过 `read_file` / `grep_files` / `semantic_search` 补充上下文
- **AND** 结果 MUST 体现对资料内容的理解，而不是只改写用户一句提示
