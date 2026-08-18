## MODIFIED Requirements

### Requirement: Knowledge panel in workbench

工作台 MUST 通过左侧 ribbon 底部「知识库」打开知识面板（亦可由 Agent 管家模板唤起），无需进入设置页即可进入以 AI 整理为主的知识工作台。页面 MUST 展示当前 LLM Wiki 状态、下一步操作、待审核提案和资料浏览入口；资料树不得成为唯一主流程。

#### Scenario: Open knowledge workspace

- **WHEN** 用户打开知识面板（左侧「知识库」或管家引导）
- **THEN** 右侧整页展示当前 LLM Wiki 的状态驱动工作台
- **AND** 页面提供「开始 AI 整理」或「查看待审核提案」等当前状态对应的主操作

#### Scenario: Browse supporting materials

- **WHEN** 用户从知识工作台进入「资料浏览」
- **THEN** 页面展示 Wiki / OKF 列表与预览
- **AND** 用户可以返回整理任务，不必离开知识面板

#### Scenario: Empty knowledge root

- **WHEN** 知识根尚无条目
- **THEN** 显示绑定 LLM Wiki 或开始首次 AI 整理的可行动空态
- **AND** 不展示长技术路径堆砌

### Requirement: wiki.ingest

系统 MUST 支持将本地文件或粘贴文本吸收为 Wiki 条目（写入 wiki 根），并刷新索引；输入文件 MUST 位于知识根或明确授权的 Source 目录内。吸收后的资料 MUST 可加入 AI 整理队列。

#### Scenario: Ingest files

- **WHEN** 用户选择知识根内或授权目录内的文件执行 ingest
- **THEN** 系统生成或更新对应 Wiki 条目并刷新索引
- **AND** 页面显示新条目并提供加入整理队列的操作

#### Scenario: Ingest rejects escape

- **WHEN** ingest 输入文件或目标路径在知识根/授权 Source 之外
- **THEN** 系统拒绝读取或写入
- **AND** 返回明确的授权范围错误

### Requirement: wiki.lint

系统 MUST 提供知识健康检查，输出可展示的问题列表（如断链、空文、重复标题等可测子集），每个问题 MUST 支持定位来源条目或生成带上下文的 AI 处理提案。

#### Scenario: Lint with issues

- **WHEN** 用户或知识管家触发 lint 且存在问题
- **THEN** 展示 issue 列表（类型、路径、说明）
- **AND** 用户可从列表定位条目或启动对应的 AI 处理提案

#### Scenario: Lint clean

- **WHEN** lint 无问题
- **THEN** 明确显示健康通过状态、扫描数量和检查时间
- **AND** 页面提供继续整理或浏览资料的入口

### Requirement: okf.promote as proposal

将 Wiki/记忆升格为 OKF 时 MUST 先生成可审阅提案，用户确认后才写入正式知识层；升格 MUST 支持用户选择一个或多个来源条目，不得隐式选择第一条条目。

#### Scenario: Promote creates draft

- **WHEN** 用户对一个或多个 Wiki 条目执行升格
- **THEN** 系统为每个来源生成带来源、目标分类和差异内容的 draft `knowledge_proposal`
- **AND** 不立即改动正式知识磁盘

#### Scenario: Accept promote

- **WHEN** 用户接受无来源冲突的提案
- **THEN** 写入正式 OKF 概念文件
- **AND** 刷新索引、重新体检并可通过知识面板再次打开

#### Scenario: Reject promote

- **WHEN** 用户拒绝提案
- **THEN** 提案标记为已拒绝
- **AND** Wiki 原文与正式知识文件均不得改变
