## MODIFIED Requirements

### Requirement: Knowledge panel in workbench

工作台 MUST 通过左侧 ribbon 底部“知识网”打开默认根知识空间，进入后的默认界面 MUST 只暴露“我的知识”“待我确认”“来源”三个用户概念。系统 MUST NOT 要求用户理解 LLM Wiki、OKF、Fabric、Provider、锚点、权威级或治理路由后才能完成日常使用。

#### Scenario: Open knowledge panel

- **WHEN** 用户打开知识入口
- **THEN** 右侧整页展示“我的知识”
- **AND** 首屏先展示来自真实根目录与索引的主题/目录、子目录与条目层级
- **AND** 提供搜索或提问、添加资料、最近资料和待确认数量
- **AND** 不与 Agent 对话列、文件预览列同时并排显示

#### Scenario: Close knowledge full page

- **WHEN** 用户关闭知识面板，或点击 ribbon“助理”切回工作台
- **THEN** 退出知识全页并恢复先前工作布局

#### Scenario: Other drawers stay narrow

- **WHEN** 用户打开版本对比或最终提示词预览
- **THEN** 仍为右侧窄抽屉，不进入知识全页模式

#### Scenario: Empty knowledge root

- **WHEN** 默认根库尚无用户资料
- **THEN** 显示“添加资料”的可行动空态
- **AND** 不提示用户先绑定 LLM Wiki 或展示内部目录流水线

### Requirement: Configure wiki root

系统 MUST 默认使用 `%APPDATA%\KnowMe\knowledge-os\wiki` 作为唯一托管根 LLM Wiki。既有外部根绑定 MUST 保持可读兼容，但新用户日常流程 MUST NOT 依赖切换根库；新增本地或远程来源作为“来源”管理，不改变默认根库身份。

#### Scenario: Use managed default root

- **WHEN** 用户未配置任何外部来源
- **THEN** 知识读取、raw 编辑、整理与搜索均使用自动建立的默认根库
- **AND** 路径不得逃逸该根目录

#### Scenario: Preserve existing external binding

- **WHEN** 升级前用户已有有效的本地 Wiki 根绑定
- **THEN** 系统继续允许读取该绑定内容
- **AND** 不删除、移动或静默覆盖原文件

## ADDED Requirements

### Requirement: Raw资料可视化编辑

“我的知识” MUST 允许用户浏览 `raw/` 资料，在应用内打开 Markdown 或纯文本内容并编辑保存；界面 MUST 显示未保存状态、保存结果和冲突错误。

#### Scenario: Open raw document

- **WHEN** 用户从资料树选择 `raw/` 内的 Markdown 或文本文件
- **THEN** 阅读区提供正文编辑器与保存操作
- **AND** 文件路径和最近更新时间可见

#### Scenario: Save raw document

- **WHEN** 用户修改正文并点击保存且磁盘内容未被其他进程修改
- **THEN** 保存成功、未保存状态清除
- **AND** 新内容立即可被搜索

#### Scenario: External change conflicts

- **WHEN** 用户编辑期间磁盘文件已被其他进程修改
- **THEN** 应用拒绝覆盖并提示重新载入
- **AND** 不丢失用户当前编辑文本

### Requirement: 用户任务驱动的知识首页

知识首页 MUST 以真实知识目录为主体，将检索、添加资料作为紧凑工具，将整理、体检和来源配置作为按需动作；织网、治理和检索路由细节 MUST NOT 作为默认一级页面展示。

#### Scenario: Browse real knowledge structure

- **WHEN** 用户打开“我的知识”
- **THEN** 首屏展示根目录下真实存在的目录、子目录与条目
- **AND** `raw`、`concepts` 等契约目录仅翻译为“资料”“已整理知识”等用户名称
- **AND** 系统不得凭空生成不存在的主题分类

#### Scenario: Expand and open index entries

- **WHEN** 用户展开目录或选择条目
- **THEN** 目录显示真实后代条目数量，前两层默认展开
- **AND** 选择条目进入现有阅读或 raw 编辑视图

#### Scenario: Empty root shows a guided welcome

- **WHEN** 根库还没有任何用户条目
- **THEN** 首页 MUST 展示以“添加第一份资料”为唯一主行动的居中欢迎引导，而不是空目录树或运维操作台
- **AND** 引导 MUST 用一句用户语说明“放资料 → AI 整理 → 随时查”的价值与用户确认主权，MUST NOT 出现 LLM Wiki、OKF、Fabric、qmd、raw、Query/Ingest/Lint 等实现术语
- **AND** 一旦根库存在任意条目，首页 MUST 切换为真实索引结构视图，欢迎引导不再出现

#### Scenario: Search from knowledge home

- **WHEN** 用户在“我的知识”输入问题或关键词并执行搜索
- **THEN** 页面展示带来源路径的命中结果
- **AND** 未命中时提供“添加资料”或调整关键词的行动入口

#### Scenario: Pending proposals are actionable

- **WHEN** 根库存在待确认的 AI 整理提案
- **THEN** “待我确认”显示数量并允许逐条查看、编辑、接受或拒绝

### Requirement: 统一根库操作接口

系统 MUST 提供可供知识界面、Agent 和其他主进程模块复用的根库 `query`、`ingest`、`lint` 接口，并 MUST 在面向用户的界面中分别称为“查找知识”“添加资料”“检查问题”。兼容 IPC MAY 保留旧名称，但不得形成第二套实现。

#### Scenario: Modules query the same root

- **WHEN** 知识首页、Agent 或其他模块查找当前用户知识
- **THEN** 它们调用同一个根库 query 服务
- **AND** 命中结构、来源路径与引擎状态遵循同一返回契约

#### Scenario: User-facing actions hide implementation terms

- **WHEN** 用户打开知识首页或更多操作
- **THEN** 页面展示“查找知识”“添加资料”“检查问题”
- **AND** 不将 query、ingest、lint、collection 或 qmd 作为操作名称

### Requirement: 根库检索使用 qmd 适配器

根库 query MUST 经过 qmd 检索适配器。qmd 可用时，系统 MUST 将当前根目录映射为不冲突的 KnowMe collection，并使用 qmd 查询；qmd 不可用或执行失败时 MUST 降级为本地检索，保持可用并准确报告实际引擎。

#### Scenario: qmd is available

- **WHEN** qmd 已安装且根库 collection 可同步
- **THEN** query 使用 qmd 返回带来源路径的结果
- **AND** 成功 ingest 或 raw 保存后更新 qmd collection

#### Scenario: qmd is unavailable

- **WHEN** qmd 未安装、被明确禁用或执行失败
- **THEN** query 使用本地词面检索返回结果
- **AND** 结果标记为降级状态且不得伪报 qmd 成功

### Requirement: 空库首触引导与首份闭环

空库首屏 MUST 以单一主行动“添加第一份资料”驱动新用户完成第一次投喂，并在保存成功后立即提供“让 AI 整理”的下一步，使用户在首次会话内走完“放资料 → 整理 → 待我确认”的完整闭环。引导 MUST 提供低门槛的投喂方式（至少支持直接粘贴/输入文字），MUST NOT 要求用户先连接外部来源或理解内部知识架构。

#### Scenario: Add the first material inline

- **WHEN** 空库用户在欢迎引导中输入或粘贴一段文字并确认添加
- **THEN** 内容 MUST 通过统一根库 ingest 写入用户资料区
- **AND** 内容为空时 MUST 给出可读提示且不写盘

#### Scenario: Offer organizing right after first save

- **WHEN** 首份资料保存成功
- **THEN** 首屏 MUST 就地提示“要我把它整理成知识吗”，提供“整理”和“以后再说”两个明确选择
- **AND** 选择“整理”进入整理流程并使结果落入“待我确认”
- **AND** 选择“以后再说”进入真实索引结构视图

#### Scenario: Connect source is a weak secondary entry

- **WHEN** 空库用户查看欢迎引导
- **THEN** “连接来源”MUST 作为弱次级入口存在，而非与“添加第一份资料”同权的主行动
