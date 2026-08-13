# capability-hub Specification

## Purpose

为 KnowMe Agent 提供统一的全屏能力管理中心，涵盖专家、技能、连接器的发现、安装、启用与生命周期管理，并保证导入安全与用户数据隔离。
## Requirements
### Requirement: Hub browse layout matches curated store pattern

Capability Hub MUST 为专家、技能和 MCP 连接器提供统一的 KnowMe 浅色暖灰视觉系统。页面 MUST 包含与工作台一致的单层外部顶部菜单栏、顶部搜索、同页类型 Tab、分类筛选、已安装筛选、可选精选区、响应式能力目录和右侧详情抽屉；在桌面常见窗口宽度下 MUST 保持可扫描的信息层级且不产生横向溢出。工作区宿主顶部栏 MUST 按“能力图标与能力 Hub 标题 → 类型 Tab → 右侧操作”的顺序组织，类型 Tab MUST 使用与工作台一级页签一致的分组底板、纯文字标签和绿色实底选中态。Hub 内嵌页面 MUST 隐藏自身重复菜单栏，内容区 MUST NOT 再重复展示英文眉题、当前类型大标题、总数徽标或介绍文案。可交互元素 MUST 提供悬停、按压与键盘焦点反馈，目录加载、无结果及错误 MUST 显示与页面结构匹配的状态。

#### Scenario: Search filters cards

- **WHEN** 用户在 Hub 搜索框输入关键词
- **THEN** 当前 Tab 下卡片列表按名称/描述/标签过滤
- **AND** 无匹配时显示带清除筛选或添加能力引导的空状态

#### Scenario: Category chip filters

- **WHEN** 用户点击某分类筛选（如「写作」「飞书」）
- **THEN** 卡片列表仅显示该分类条目
- **AND** 当前分类具有可感知的选中态

#### Scenario: Installed filter

- **WHEN** 用户开启「已安装」筛选
- **THEN** 仅显示 install store 中 status 为 installed/enabled/disabled 的条目
- **AND** 筛选状态在视觉与无障碍状态上均可识别

#### Scenario: Card opens detail drawer

- **WHEN** 用户点击或通过键盘激活某能力卡片
- **THEN** 右侧抽屉展示描述、版本、来源、依赖、启用开关与安装/更新/卸载操作
- **AND** 抽屉与当前目录保持一致的主题和信息层级

#### Scenario: Catalog is loading

- **WHEN** 当前 Tab 的能力目录正在加载
- **THEN** 页面显示与精选区及能力卡片形状匹配的骨架占位
- **AND** 不显示会被误认为真实能力的旧目录内容

#### Scenario: Catalog load fails

- **WHEN** 能力目录请求失败且没有可展示的回退条目
- **THEN** 页面显示可读错误说明与重试操作
- **AND** 错误状态不破坏页面布局或关闭入口

#### Scenario: Hub adapts to window width

- **WHEN** Hub 宽度从宽桌面缩小到窄桌面窗口
- **THEN** 标题、搜索、类型 Tab、筛选和能力目录按可用空间重排
- **AND** 页面不产生横向滚动，核心操作保持可见

#### Scenario: Capability type tab matches workbench navigation

- **WHEN** 用户查看或切换“专家”“技能”“MCP 连接器”
- **THEN** 工作区外层顶部栏显示能力图标与“能力 Hub”标题，页签紧随其后并使用与工作台“首页 / 工作流”相同的菜单栏位置、底板、圆角、字号与绿色选中态
- **AND** 页签仅显示文字且当前项保持正确的 `aria-selected` 状态
- **AND** 内嵌 Hub 页面不再渲染第二条菜单栏
- **AND** 搜索与筛选直接位于顶部栏下方，不重复展示当前类型介绍区

### Requirement: Unified capability catalog and install store

系统 MUST 维护统一 capability catalog（内置精选 + 用户安装）与 install store。每条记录 MUST 包含：`id`, `kind`（expert|skill|connector）, `source`, `version`, `enabled`, `status`, `contentHash`, `installedAt`。

#### Scenario: Install curated skill

- **WHEN** 用户在 Hub 对精选技能点击「安装」
- **THEN** 文件复制到 `%APPDATA%\KnowMe\capabilities\skills\<id>\`
- **AND** install store 记录 status=installed
- **AND** 卡片显示「已安装」

#### Scenario: Enable and disable

- **WHEN** 用户在抽屉关闭某已安装能力的启用开关
- **THEN** install store 中 enabled=false
- **AND** Agent 运行时不再加载该能力（已绑定 Session 快照除外）

#### Scenario: Uninstall removes user copy

- **WHEN** 用户卸载某能力
- **THEN** 对应目录从 capabilities 下删除（内置 curated 仅移除 install 记录）
- **AND** install store 移除该条目

#### Scenario: Update replaces content

- **WHEN** 用户对已安装能力执行「更新」且来源有新版本
- **THEN** 原子替换目录内容并更新 version 与 contentHash

### Requirement: Multi-source import paths

Hub MUST 支持从以下来源添加能力：内置精选、本地文件夹、ZIP 包、HTTPS URL、自定义创建向导。

#### Scenario: Import local folder

- **WHEN** 用户选择本地文件夹且包含合法 manifest/SKILL.md/EXPERT.md
- **THEN** 校验通过后安装到 capabilities 对应 kind 目录

#### Scenario: Import ZIP package

- **WHEN** 用户选择 ZIP 文件
- **THEN** 系统解压到 staging、校验、安装，staging 清空

#### Scenario: Import HTTPS URL

- **WHEN** 用户输入 `https://` 开头的 ZIP 或 manifest URL
- **THEN** 下载、校验、安装
- **AND** 未知来源 MUST 经用户确认信任

#### Scenario: Custom create wizard

- **WHEN** 用户通过「自定义创建」向导新建技能/专家/连接器
- **THEN** 生成最小合法目录结构并写入 capabilities

### Requirement: Import security enforcement

导入流程 MUST 拒绝：ZIP path traversal、超限大小/文件数、非 HTTPS 远程 URL、`file://` 远程引用、软链接逃逸 capabilities 根目录。Secret MUST NOT 以明文写入磁盘。

#### Scenario: Reject zip traversal

- **WHEN** ZIP 含 `../etc/passwd` 或绝对路径条目
- **THEN** 导入失败并返回可读错误，不写入 capabilities

#### Scenario: Reject oversized package

- **WHEN** 包总大小超过 50MB 或单文件超过 10MB 或文件数超过 500
- **THEN** 导入失败

#### Scenario: Reject non-https URL

- **WHEN** 用户输入 `http://` 或 `file://` URL
- **THEN** 拒绝下载并提示仅支持 HTTPS

#### Scenario: Secrets not persisted

- **WHEN** manifest 含 API token 或 access_token 字段
- **THEN** 拒绝安装或剥离敏感字段，仅允许 `env:VAR_NAME` 引用

### Requirement: User data lives under AppData

所有 Hub 管理的已安装能力 MUST 存储在 `%APPDATA%\KnowMe\capabilities\`。Renderer MUST NOT 直接读写该路径。

#### Scenario: Main process owns IO

- **WHEN** Hub 请求安装/卸载/列表
- **THEN** 由主进程 IPC handler 读写 capabilities 目录并返回 DTO

### Requirement: Unified capability entry uses in-page tabs

左侧 rail MUST 提供一个“能力”图标入口。点击该入口 MUST 打开统一 Capability Hub；Hub MUST 在同一页面内提供“专家”“技能”“MCP 连接器”三个顶部 Tab，并允许用户不离开页面地切换能力类型。

#### Scenario: Open Hub from unified capability icon

- **WHEN** 用户点击 rail“能力”图标
- **THEN** 全屏 Capability Hub 打开且“专家”Tab 为激活态
- **AND** 工作台主内容被 Hub 覆盖，Hub 可通过关闭按钮或 Esc 退出

#### Scenario: Switch capability type in page

- **WHEN** 用户点击“技能”或“MCP 连接器”Tab
- **THEN** Hub 保持打开并切换当前能力类型的卡片、筛选和操作
- **AND** 当前 Tab 具有可感知的选中态与正确的无障碍状态

#### Scenario: Deep link preserves tab

- **WHEN** 用户从 Agent 空状态或其他既有深链打开指定能力类型
- **THEN** Hub 初始 Tab 与深链类型一致
- **AND** 随后的 Tab 切换仍在同一 Hub 页面完成

### Requirement: Hub imports a Cursor repository through preview and confirmation
Capability Hub MUST 在添加能力对话框提供“Cursor 仓库”来源，并在写入前展示扫描预览、仓库路径、各类型数量与安全警告。

#### Scenario: User selects a Cursor repository
- **WHEN** 用户点击“选择 Cursor 仓库”并选中本地目录
- **THEN** Hub 展示该仓库发现的专家、技能和连接器摘要
- **AND** 用户可确认注册或取消且取消不产生写入

#### Scenario: Import reports partial failure
- **WHEN** 部分能力因无效格式或明文密钥无法注册
- **THEN** Hub 明确展示成功、跳过与失败条目
- **AND** MUST NOT 将部分失败静默显示为全部成功

### Requirement: User-installed capabilities are visible in the unified catalog
系统 MUST 将本地、ZIP、HTTPS、自定义和 Cursor 仓库来源的成功安装项合并到统一 catalog，使其可在 Hub 中搜索、筛选、启停和卸载。

#### Scenario: Local capability registration completes
- **WHEN** 任一非精选来源能力安装成功
- **THEN** 对应卡片立即出现在正确 Tab
- **AND** 卡片显示真实来源、安装状态和可用性

### Requirement: Local trust confirmation completes in the UI
未知本地来源返回需信任状态时，Hub MUST 向用户展示确认步骤，并仅在确认后以相同来源重试；拒绝信任 MUST 保持未安装状态。

#### Scenario: User confirms a local source
- **WHEN** 后端返回 `trust_required` 且用户确认信任
- **THEN** Hub 以显式信任标记重试导入
- **AND** 最终结果按成功或失败真实反馈

#### Scenario: User rejects trust
- **WHEN** 用户取消或拒绝本地来源信任
- **THEN** Hub 不写入能力
- **AND** 添加对话框保持可恢复状态

### Requirement: Hub exposes capability governance facts

能力详情 MUST 展示统一声明中的 required/optional 依赖、权限、输入、输出、风险、来源证据和信任状态，不得以硬编码空依赖代替真实数据。

#### Scenario: User opens governed capability

- **WHEN** 用户打开具有统一声明的能力详情
- **THEN** 抽屉 SHALL 展示真实治理字段
- **AND** legacy 适配字段 SHALL 标明其 provenance

### Requirement: Hub enforces dependencies and risk confirmation

安装或启用能力前，Hub MUST 验证 required dependencies；对 high 或 critical 风险能力 MUST 在写入状态前取得明确确认。

#### Scenario: Required dependency is unavailable

- **WHEN** 用户安装或启用缺少必需依赖的能力
- **THEN** 操作 MUST 被阻止
- **AND** UI SHALL 提供缺失依赖 ID 和可操作说明

#### Scenario: User rejects high-risk confirmation

- **WHEN** 用户拒绝 high/critical 能力的风险确认
- **THEN** install store MUST 保持原状态

#### Scenario: Optional dependency is unavailable

- **WHEN** 能力仅缺少可选依赖
- **THEN** UI SHALL 显示警告但允许用户继续

### Requirement: Tool contract preview in connector drawer

Capability Hub 连接器/ MCP 详情 MUST 展示 Registry 契约：risk、requiresApproval、scope、timeout、health。

#### Scenario: MCP health degraded

- **WHEN** MCP health=degraded
- **THEN** 卡片与抽屉展示警告且 Agent 投影 MAY 排除该 connector 工具

### Requirement: Risk confirmation on enable write tools

启用含 `risk=external|destructive` 工具入 allowlist 时，Hub MUST 二次确认。

#### Scenario: Enable feishu IM write

- **WHEN** 用户勾选 feishu.draft_send_message
- **THEN** 显示风险说明对话框
- **AND** 确认后才写入 allowlist

### Requirement: Playwright MCP install guidance

当 catalog 含 browser automation pack 时，Hub MUST 提供 Playwright MCP 安装/配置指引链接。

#### Scenario: Missing playwright server

- **WHEN** 无 Playwright MCP connector
- **THEN** Hub 展示安装步骤而非空列表

### Requirement: Playwright MCP install guidance clickable

Capability Hub 中 Playwright MCP 安装指引 MUST 包含可点击链接或按钮（打开文档或外部安装说明）；health 红灯时 MUST 与安装步骤一致。

#### Scenario: Install link opens

- **WHEN** 用户在 Hub 点击 Playwright 安装指引
- **THEN** 打开有效 URL 或系统浏览器
- **AND** 不产生未预期写操作

#### Scenario: Health red matches missing MCP

- **WHEN** Playwright MCP 未配置
- **THEN** Hub 显示 health 失败与安装指引
- **AND** 文案与单测 fixture 一致

### Requirement: Agent profile configuration entry

Capability Hub MUST 为已安装 Expert/Agent 提供 Profile 配置入口，并显示其可用 Skill、连接器、输入输出、权限、风险和版本。保存配置后 MUST 能从当前目标或流程上下文继续进入工作台。

#### Scenario: Open Agent profile

- **WHEN** 用户在能力 Hub 打开已安装 Agent
- **THEN** 详情抽屉提供进入 Profile 配置的入口，并展示真实治理信息

#### Scenario: Return to active goal

- **WHEN** 用户从工作台目标进入 Hub 修改 Agent Profile 并保存
- **THEN** Hub 返回原目标和流程上下文，不要求用户重新输入目标

### Requirement: Capability to workflow handoff

Capability Hub MUST 支持将已安装 Agent 或 Skill 添加到当前工作流草稿；未安装或未授权能力 MUST 进入安装/授权引导，而不是写入不可执行引用。

#### Scenario: Add capability to workflow

- **WHEN** 用户选择“加入当前工作流”
- **THEN** 工作台收到带有 capabilityId、版本和当前上下文的结构化引用

#### Scenario: Unavailable capability handoff

- **WHEN** 用户选择未安装或未授权能力
- **THEN** Hub 显示修复入口，并且不创建不可执行的工作流节点

### Requirement: Capability hub is the sole home for agent authoring

能力界面 MUST 是创建、编辑、调优 Agent（专家）的唯一场所。MUST 区分来源：官方(curated)、自建(local)。MUST 允许为 Agent 配置 Skill、专属知识库范围与 Tool（连接器）。工作台及助理 MUST NOT 再提供 Agent 的创建/编辑/调优入口。

#### Scenario: Create a custom agent

- **WHEN** 用户在能力界面专家页选择「添加自己的专家」
- **THEN** 进入 Agent 创建表单，可设 persona、Skill、知识库范围与 Tool，保存后作为「自建」出现在专家列表

#### Scenario: Tune an agent

- **WHEN** 用户对某专家点「调优」
- **THEN** 在能力界面内配置其 Skill / 知识库范围 / Tool，保存后配置随该 Agent 持久化

#### Scenario: Official agents are read-only

- **WHEN** 用户查看 curated 官方专家
- **THEN** 可「复制为自建」再调优，MUST NOT 直接修改官方版本

### Requirement: Installed agents feed workbench orchestration

在能力界面安装或自建的 Agent MUST 进入统一 Agent store，并作为工作台编排的节点候选。MUST NOT 要求用户在工作台再次登记 Agent。

#### Scenario: Installed agent appears in orchestration

- **WHEN** 用户在能力界面安装或新建一个 Agent，随后进入工作台编排
- **THEN** 该 Agent 出现在编排节点候选库，可拖入 DAG

### Requirement: Real agent catalog

能力界面专家目录 MUST 反映真实 Agent 数据（本地 + 官方种子），MUST NOT 使用占位 / Mock 数据充数。

#### Scenario: No mock experts

- **WHEN** 用户打开能力界面专家页
- **THEN** 列表为真实可用/可安装的 Agent，不含仅用于演示的占位条目

