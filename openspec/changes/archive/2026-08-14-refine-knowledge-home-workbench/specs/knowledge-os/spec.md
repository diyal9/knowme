## MODIFIED Requirements

### Requirement: 用户任务驱动的知识首页

知识首页 MUST 以搜索或提问为第一视觉中心，并以真实知识目录为工作台主体。添加资料、检查问题 MUST 作为紧凑次级动作；织网、治理和 Fabric 兼容路由 MUST NOT 作为默认一级展示。首页 MUST NOT 使用宣传式 Hero 标题或长段产品说明。

#### Scenario: Search-first home layout

- **WHEN** 用户打开“我的知识”且根库已有条目
- **THEN** 首屏以搜索输入与提交为最高视觉层级
- **AND** 次级动作仅展示短中文标签（如添加资料、检查问题、浏览全部、Obsidian）
- **AND** 页面不出现 Query、Ingest、Lint、Fabric、织网、authority 等内部术语

#### Scenario: Browse real knowledge structure

- **WHEN** 用户查看首页目录区
- **THEN** 展示根目录下真实存在的目录、子目录与条目
- **AND** `raw`、`concepts` 等契约目录仅翻译为“资料”“已整理知识”
- **AND** 资料与条目计数以小型状态信息呈现，不得使用大号统计卡片作为主视觉

#### Scenario: Search from knowledge home

- **WHEN** 用户输入关键词并搜索
- **THEN** 展示带路径与摘要的命中结果，并可打开对应资料
- **AND** 检索引擎降级时使用普通用户可理解的“智能检索/本地检索”说明
- **AND** 系统 MUST NOT 向用户伪报结构化检索已成功

#### Scenario: Pending proposals stay subtle

- **WHEN** 存在待确认整理建议
- **THEN** 首页提供简洁的“待确认”入口与数量
- **AND** 不得将大量待确认建议做成首屏主焦点或压迫性横幅

#### Scenario: Health issues are actionable

- **WHEN** 资料空间或知识保护状态异常
- **THEN** 首页以紧凑警告条提示并可进入检查问题
- **AND** 正常状态下不得占用首屏主要区域

### Requirement: Professional graph handoff

KnowMe SHALL 在首页提供带可访问标签的 Obsidian 次级入口用于关系图谱探索。默认知识界面 MUST NOT 实现或展示 competing 应用内图谱画布。

#### Scenario: Obsidian secondary action

- **WHEN** 用户在首页选择 Obsidian 入口
- **THEN** 系统通过现有桥接打开当前根知识库或提供安装引导
- **AND** 按钮 MUST 含可读中文标签，不得仅为无标签图标
