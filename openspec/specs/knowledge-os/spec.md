# Spec: Knowledge OS

## Purpose

工作台内的公司知识操作系统：浏览、检索、吸收、健康检查与升格；Agent 默认可查询并引用。

## Requirements

### Requirement: Knowledge panel in workbench

工作台 MUST 通过左侧 ribbon 底部「知识库」打开知识面板（亦可由 Agent 管家模板唤起），无需进入设置页即可浏览 Wiki / OKF 摘要列表。
知识面板 MUST 以右侧整页单列堆叠展示，MUST NOT 与 Agent/编辑区多栏并排展开。

#### Scenario: Open knowledge panel

- **WHEN** 用户打开知识面板（左侧「知识库」或管家引导）
- **THEN** 右侧整页展示知识堆叠面板（wiki / OKF 列表与预览等），且不与 Agent 对话列、文件预览列同时并排显示

#### Scenario: Close knowledge full page

- **WHEN** 用户关闭知识面板，或点击 ribbon「Agent」切回工作台
- **THEN** 退出知识全页，恢复 Agent/编辑布局

#### Scenario: Other drawers stay narrow

- **WHEN** 用户打开版本对比或最终提示词预览
- **THEN** 仍为右侧窄抽屉，不进入知识全页模式

#### Scenario: Empty knowledge root

- **WHEN** 知识根尚无条目
- **THEN** 显示空态引导：添加 Wiki 源或执行首次 ingest，不展示长技术路径堆砌

### Requirement: Configure wiki root

用户 MUST 能指定知识 Wiki 根：默认 `%APPDATA%\KnowMe\knowledge-os\wiki`，或绑定某个已添加的 local Source。

#### Scenario: Use default wiki root

- **WHEN** 用户未绑定 Source
- **THEN** 知识工具读写默认知识根，且路径不得逃逸该根目录

#### Scenario: Bind local source as wiki

- **WHEN** 用户将某 local Source 标为 Wiki 根并确认
- **THEN** 后续 ingest/query/lint 以该 Source `rootPath` 为准（仍受穿越校验）

### Requirement: wiki.query with citations

Agent 或面板发起的知识问答 MUST 返回带引用的命中结果（路径或概念 id），用户可导航到源条目。

#### Scenario: Query returns citations

- **WHEN** 用户提问涉及公司约定且知识库中有相关条目
- **THEN** 回答或命中列表包含至少一条可点击/可展示的来源路径（或等价引用）

#### Scenario: Query miss

- **WHEN** 知识库无相关条目
- **THEN** 明确提示未找到，并建议 ingest 或换关键词；不得伪造来源

### Requirement: wiki.ingest

系统 MUST 支持将本地文件或粘贴文本吸收为 Wiki 条目（写入 wiki 根），并刷新索引。

#### Scenario: Ingest files

- **WHEN** 用户选择知识根内（或授权目录内）的文件执行 ingest
- **THEN** 生成或更新对应 wiki md，面板列表可见新条目

#### Scenario: Ingest rejects escape

- **WHEN** ingest 目标路径在知识根/授权 Source 之外
- **THEN** 拒绝写入并返回明确错误

### Requirement: wiki.lint

系统 MUST 提供知识健康检查，输出可展示的问题列表（如断链、空文、重复标题等可测子集）。

#### Scenario: Lint with issues

- **WHEN** 用户或知识管家触发 lint 且存在问题
- **THEN** 展示 issue 列表（类型、路径、说明），并可从列表定位条目

#### Scenario: Lint clean

- **WHEN** lint 无问题
- **THEN** 明确显示健康通过状态

### Requirement: okf.promote as proposal

将 Wiki/记忆升格为 OKF 时 MUST 先生成可审阅提案，用户确认后才写入 `knowledge/`。

#### Scenario: Promote creates draft

- **WHEN** 用户对某 wiki 条目执行升格
- **THEN** 产生 `knowledge_proposal` 产物（draft），不立即改 OKF 磁盘

#### Scenario: Accept promote

- **WHEN** 用户接受该提案
- **THEN** 写入 OKF 概念文件且可通过知识面板再次打开

### Requirement: Agent defaults to knowledge context

在知识优先或知识管家角色下，Agent 回答公司事实类问题 MUST 优先使用 `wiki.query` 结果，而非仅当前打开文件正文。

#### Scenario: Answer without open file

- **WHEN** 未打开编辑器文件，用户询问知识库中已有约定
- **THEN** Agent 仍可基于 wiki.query 作答并带来源
