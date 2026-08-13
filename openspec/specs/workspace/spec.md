# workspace Specification

## Purpose

定义 KnowMe 单窗口工作台的窗口、内容源、编辑区、Agent 入口、Work Surface 与远程工作流交互体验。
## Requirements
### Requirement: Single-window workbench

应用 MUST 使用唯一的 KnowMe 工作台主窗口，并在关闭窗口时隐藏到托盘而非退出。

#### Scenario: Launch unique workbench window

- **WHEN** 应用启动
- **THEN** 打开唯一主窗口「工作台」（常规带边框窗口），标题品牌为 KnowMe
- **AND** 不再弹出多张便签浮窗
- **AND** 工作台含三区：左侧项目/文件树、中部标签页编辑区、右侧可展开面板

#### Scenario: Close window hides to tray

- **WHEN** 用户关闭工作台窗口
- **THEN** 窗口隐藏到托盘且应用不退出
- **AND** 托盘「显示工作台」可恢复窗口

### Requirement: Content source file tree

工作台侧栏 SHALL 根据 Source 配置展示内容源文件树或可执行的配置引导。

#### Scenario: Configured source appears first

- **WHEN** 已配置至少一个 Source
- **THEN** 工作台侧栏 SHALL 优先展示内容源与其文件树

#### Scenario: Missing source shows setup guidance

- **WHEN** 无 Source
- **THEN** 侧栏 SHALL 提示前往设置添加本地文件夹或 GitLab 项目

### Requirement: Workspace file tabs

工作台 MUST 通过标签页打开文件，并持久化上次打开的标签与激活项目。

#### Scenario: Open file from project tree

- **WHEN** 用户从项目树打开一个文件
- **THEN** 在标签页区新增或激活对应标签

#### Scenario: Close file tab without deleting

- **WHEN** 用户关闭标签页
- **THEN** 该文件从标签栏移除
- **AND** 不删除磁盘文件

#### Scenario: Restart restores file tabs

- **WHEN** 重启应用
- **THEN** 恢复来自 `settings.workspaceState` 的上次打开标签页与激活项目

### Requirement: Split editor panes

编辑区 MUST 支持左右分屏与恢复单栏，两个 pane SHALL 各自持有独立标签栈。

#### Scenario: Enter split view

- **WHEN** 用户点击分屏
- **THEN** 编辑区拆为左右两个独立 pane，各自持有标签栈
- **AND** 左右 pane 可同时显示不同文件（如提示词 / 纪要）

#### Scenario: Close one pane

- **WHEN** 用户关闭其中一个 pane
- **THEN** 编辑区回到单栏

### Requirement: Tray menu excludes legacy note actions

托盘菜单 MUST 仅提供显示工作台、设置和退出，并移除便签时代遗留操作。

#### Scenario: Open tray menu

- **WHEN** 用户打开托盘菜单
- **THEN** 菜单仅含显示工作台、设置、退出
- **AND** 不含「继续编辑 / 最小化到托盘 / 新建便签 / 总览」等便签遗产项

### Requirement: Intent and Work Surface layout

Agent 模式 MUST 并排展示左栏意图/轨迹与右栏 Work Surface，并保持 Agent Session Tab 与文件 Tab 为两套独立 chrome。

#### Scenario: Agent mode shows intent and work surface

- **WHEN** 用户处于 Agent 模式
- **THEN** 主区为左栏意图/轨迹与右栏 Work Surface 并排
- **AND** 右栏遵循 `work-surface` 状态机（默认文档，draft 时可审阅）
- **AND** Agent Session Tab 与文件 Tab 仍为两套独立 chrome

#### Scenario: Edit mode may hide agent column

- **WHEN** 应用处于编辑模式（mode-edit）
- **THEN** MAY 隐藏 Agent 列（既有行为）

### Requirement: Hub visual consistency with workbench

Capability Hub MUST 使用浅色克制视觉，与 workbench chrome 协调；MUST NOT 引入与主界面冲突的深色主题（除非用户全局深色模式已启用且 Hub 跟随）。

#### Scenario: Light theme hub

- **WHEN** 用户处于默认浅色工作台
- **THEN** Hub 背景与卡片风格为浅色克制，参考元器式布局

### Requirement: Daemon launch dialog prefers remote context defaults

当 Workbench 通过远程 Daemon 启动工作流时，启动弹窗 MUST 优先展示 Daemon 返回的默认上下文，而不是仅依赖本地缓存。

#### Scenario: Load launch defaults from Daemon

- **GIVEN** 用户打开一个可通过 Daemon 启动的工作流
- **AND** Daemon 提供该 workflow 的默认上下文
- **WHEN** 启动弹窗渲染启动上下文区域
- **THEN** `GitLab 项目 / 仓库`、`ref`、`commit`、输入制品目录、PRD/asset 文件与输出目录 SHOULD 优先展示 Daemon 返回值
- **AND** 用户仍可以手动修改这些字段后再提交

#### Scenario: Graceful fallback when Daemon has no defaults endpoint

- **GIVEN** 用户打开一个可通过 Daemon 启动的工作流
- **AND** 当前 Daemon 版本尚未实现默认上下文接口
- **WHEN** Workbench 尝试读取默认上下文
- **THEN** 弹窗 MUST 继续可用
- **AND** 系统 SHALL 回退到已有本地缓存与占位符
- **AND** MUST NOT 因接口缺失阻断任务启动

### Requirement: PRD field supports requirement asset files

启动上下文中的 PRD 字段 MUST 明确支持仓库内的需求附件文件，而不仅是 Markdown 文档。

#### Scenario: Input PRD markdown path

- **GIVEN** 用户准备启动远程工作流
- **WHEN** 用户在 `PRD / asset 文件` 字段填写 `PRD.md`
- **THEN** 系统 SHALL 将其作为 `inputs.prd` 提交
- **AND** 路径 MUST 继续按仓库内相对路径校验

#### Scenario: Input requirement asset path

- **GIVEN** 用户准备启动远程工作流
- **WHEN** 用户在 `PRD / asset 文件` 字段填写 `assets/mockup.png`
- **THEN** 系统 SHALL 将其作为 `inputs.prd` 提交
- **AND** 系统 MUST NOT 因其不是 Markdown 文件而拒绝
- **AND** 路径仍 MUST NOT 是绝对路径或目录穿越路径

### Requirement: Launch dialog DAG preview reflects real branches

工作流启动弹窗右侧的「DAG 关系图」MUST 基于 `buildWorkflowGraph()` 的 `edges` 渲染真实分支结构，MUST NOT 仅将节点拍平成线性列表。

#### Scenario: Render branch edges with labels

- **GIVEN** 用户打开一个含并行 / 网关 / 循环节点的工作流启动弹窗
- **WHEN** 右侧关系图渲染
- **THEN** 具有多条出边的节点 MUST 在卡片内以出口徽标逐条显示边标签（如 通过 / 打回 / 修订 / 并行 / 汇合 / 检查 / 修复 / 成功）与目标节点标题
- **AND** 边标签 SHOULD 按语义着色（通过/成功=正向绿、打回/失败/耗尽=警示红、修订/修复/检查=琥珀、并行=分叉色、汇合=中性）

#### Scenario: Back edges reference upstream nodes without duplication

- **GIVEN** 工作流存在指向已出现上游节点的边（如循环回环、汇合）
- **WHEN** 关系图渲染到该边
- **THEN** MUST 以「↩ 回到 <目标节点标题>」形式引用该上游节点
- **AND** MUST NOT 重复渲染该节点卡片

#### Scenario: Linear workflow stays clean

- **GIVEN** 工作流为单一顺序链（每节点最多一条无标签出边）
- **WHEN** 关系图渲染
- **THEN** 节点间 MUST 以简洁竖向连接箭头相连
- **AND** 有标签的顺序边 MAY 在连接器上显示标签芯片

#### Scenario: Node styling by type

- **GIVEN** 关系图渲染节点卡片
- **THEN** 每个节点 MUST 按类型（agent / script / loop / parallel / gate / terminal）显示对应左侧色栏与类型标签
- **AND** 入口节点 MUST 带「起点」徽标与高亮描边
- **AND** 弹窗侧栏保持只读预览，MUST NOT 引入第三方图库

#### Scenario: Degrade when graph unavailable

- **GIVEN** 工作流加载失败或无节点
- **WHEN** 关系图渲染
- **THEN** 面板 MUST 降级为提示态（`.degraded`），显示错误或兜底文案，MUST NOT 抛错

### Requirement: Runner never fakes completion when graph unavailable

工作台运行时「任务工作间」在工作流节点定义加载失败（degraded）时 MUST NOT 展示 `100%` 或 `已完成 N/N 步` 等成功进度，MUST 将 degraded 占位节点排除在进度计数外。

#### Scenario: Degraded graph shows unknown progress

- **GIVEN** Daemon 任务 `state === 'done'`，但本地无法加载该 workflow 的节点定义
- **WHEN** 任务工作间渲染进度
- **THEN** 进度 MUST 显示「无法确认进度」类文案，MUST NOT 显示 `100%` 或 `已完成 1/1 步`
- **AND** degraded 占位节点 MUST NOT 计入 `已完成 / 总步数`

#### Scenario: Consistent status semantics

- **GIVEN** 任务工作间同时渲染顶部进度、当前状态、执行节点三处
- **WHEN** 工作流加载失败
- **THEN** 三处状态语义 MUST 一致，MUST NOT 同时出现「执行中」「done · 100%」「加载失败」自相矛盾组合

### Requirement: Only real artifacts are surfaced

任务工作间与左侧助手建议 MUST 只呈现 Daemon `/artifacts` 真实返回且可打开的产物；任务**输入**路径 MUST NOT 被当作「产物」展示或推荐。

#### Scenario: Input path is not an artifact

- **GIVEN** 任务 context 含输入配置 `inputs.root = ingest/` 或 `inputs.prd = brief.md`
- **WHEN** 任务工作间渲染「任务产物」区，或左侧助手生成下一步建议
- **THEN** MUST NOT 将 `ingest/brief.md` 等输入路径列为产物或引导用户查看
- **AND** 仅当 Daemon `/artifacts` 返回该文件时才展示为产物

#### Scenario: Presenter desensitization applies to chat suggestions

- **GIVEN** 左侧助手生成含内部路径（如 `ingest/`）的建议文案
- **WHEN** 文案对 C 端用户展示
- **THEN** `presenter` 脱敏规则 MUST 生效，MUST NOT 泄露内部实现路径

### Requirement: Artifacts open reliably or fail gracefully

产物打开 MUST 先将相对路径解析到激活仓库根再打开；无法解析或文件未产出时 MUST 给出友好提示，MUST NOT 抛出系统级「文件不存在」报错。

#### Scenario: Relative artifact path resolves to repo root

- **GIVEN** Daemon 返回相对路径产物（如 `docs/report.md`）
- **WHEN** 用户点击该产物
- **THEN** 系统 MUST 以「激活仓库根 + 相对路径」解析后打开
- **AND** 路径 MUST NOT 被当作 OS 当前工作目录相对路径直接 `openPath`

#### Scenario: Ungenerated artifact gives friendly hint

- **GIVEN** 产物在本地不存在（未同步或尚未产出）
- **WHEN** 用户点击该产物
- **THEN** 系统 MUST 提示「该产物尚未生成或未同步」
- **AND** MUST NOT 弹出系统级文件缺失错误

### Requirement: Load failure has an actionable exit

工作流加载失败时，degraded 提示 MUST 对 C 端可读，并 MUST 提供跳转「设置 → 内容源」的行动入口。

#### Scenario: Actionable degraded hint

- **GIVEN** 任务工作间因激活内容源无 `.cursor/workflows/team-run.json` 而 degraded
- **WHEN** 用户查看执行节点区
- **THEN** 文案 MUST 说明可能原因（激活内容源与工作流不匹配）而非仅「无法从仓库加载节点定义」
- **AND** MUST 提供一键跳转内容源设置的入口

### Requirement: Floating assistant uses a low-interruption icon anchor

工作台悬浮助理入口 MUST 默认以右下角的单一 KnowMe 品牌标记呈现，不得使用常驻的实心药丸底板、通用实心聊天气泡或厚重投影；入口 MUST 在浅色和深色主题中保持可识别，并保留原有快捷操作能力。状态提示 MUST 与品牌标记共享视觉层级，不得同时出现两个相互竞争的强调红点。

#### Scenario: Default workspace presentation

- **WHEN** 用户首次打开工作台或尚未保存悬浮入口位置
- **THEN** 悬浮助理 SHALL 显示在工作台右下角
- **AND** 常态只显示轻量 KnowMe 节点标记，不显示实心药丸容器或通用实心聊天气泡

#### Scenario: Resume suggestion stays visually quiet

- **WHEN** 系统存在可恢复工作
- **THEN** 入口 SHALL 最多显示一处珊瑚色状态提示
- **AND** 状态提示 MUST NOT 显示数字“1”
- **AND** 按钮 aria-label SHALL 继续说明存在可恢复工作

#### Scenario: Theme and interaction visibility

- **WHEN** 用户切换浅色或深色系统主题
- **THEN** 品牌标记 SHALL 使用与背景有足够区分的主题色
- **AND** 悬停、键盘焦点与处理中状态 SHALL 继续提供可感知但克制的反馈

#### Scenario: Existing assistant interactions remain available

- **WHEN** 用户点击或纵向拖动品牌标记
- **THEN** 点击 SHALL 打开原有快捷面板
- **AND** 纵向拖动 SHALL 更新并持久化入口位置
- **AND** 可恢复工作提示与处理状态 SHALL 继续可用

### Requirement: Left rail provides one unified capability entry

工作台左侧 rail MUST 仅提供一个“能力”图标入口。图标 MUST 有 tooltip 与 aria-label。点击 MUST 打开 Capability Hub 全屏层（见 capability-hub spec），不得再将专家、技能和连接器作为三个独立 rail 入口展示。能力入口 MUST 紧随工作台入口，并位于自动化入口上方的主导航分组中；自动化入口 MUST 位于其后的分隔分组。

#### Scenario: Single capability rail icon visible

- **WHEN** 用户进入 Agent 工作台
- **THEN** rail 仅显示一个“能力”图标入口
- **AND** rail 不再分别显示专家、技能、连接器三个图标

#### Scenario: Capability and automation use the requested order

- **WHEN** 用户查看工作台左侧 rail
- **THEN** 能力入口紧随工作台入口显示
- **AND** 自动化入口显示在能力入口下方的分隔分组中

#### Scenario: Capability icon opens unified hub

- **WHEN** 用户点击 rail“能力”图标
- **THEN** 工作台上方展示 Capability Hub 全屏 overlay
- **AND** Hub 默认激活“专家”Tab
- **AND** 底层 Agent 会话状态保留

#### Scenario: Close hub returns to workbench

- **WHEN** 用户按 Esc 或点击 Hub 关闭
- **THEN** overlay 关闭且回到先前 Agent 视图

### Requirement: Agent empty state prioritizes work tasks

Agent 空状态 MUST 以任务与知识入口为主，不得显示“打开能力 Hub”卡片；工作台 SHALL 保持左侧能力、知识库与设置入口位置清晰且不得恢复独立片段库。

#### Scenario: Empty agent shows task and knowledge entry

- **WHEN** Agent 列无消息
- **THEN** 空状态以任务/知识入口为主（含知识管家模板）
- **AND** 不得显示“打开能力 Hub”卡片
- **AND** 不得仅显示单一聊天提示

#### Scenario: Open knowledge panel from ribbon

- **WHEN** 用户点击左侧 ribbon 底部“知识库”
- **THEN** 打开知识面板（见 `knowledge-os`）

#### Scenario: Open settings from ribbon

- **WHEN** 用户点击左侧 ribbon 底部“设置”
- **THEN** 打开设置窗口

#### Scenario: Open capability hub from unified rail entry

- **WHEN** 用户点击左侧 rail“能力”入口
- **THEN** 打开统一 Capability Hub

#### Scenario: Knowledge controls remain in designated locations

- **WHEN** 工作台渲染 Agent 顶栏、文件树底栏与设置页知识库管理
- **THEN** Agent 对话顶栏 MUST NOT 放置知识面板按钮
- **AND** 文件树底栏 MUST NOT 放置知识库、设置或片段库
- **AND** 设置页知识库管理保留，文案 MAY 引导至工作台知识库入口
- **AND** 工作台 MUST NOT 提供独立“片段库”入口或 snippets IPC

### Requirement: Game studio empty state

When settings industry is `game`, the agent empty state MUST show four task scenarios (策划需求、研发实现、测试验收、制作推进) instead of generic office shortcuts.

#### Scenario: Game industry home

- **WHEN** user opens agent surface with industry game
- **THEN** empty state displays KnowMe 工作伙伴 and four scenario buttons
- **AND** left side rail buttons remain visible and unchanged

### Requirement: Console-first workbench navigation

工作台 MUST 以总览、管线、运行、Agent、编排为一级导航；目标输入 MUST 作为新建运行过程的一部分，而不是占据主页的营销式 Hero。自动化可保留应用侧入口，但其计划和失败 MUST 投影到总览与统一运行中心。

#### Scenario: Open workbench

- **WHEN** 用户进入工作台
- **THEN** 顶栏显示领域筛选、环境健康状态和“新建运行”，正文默认展示运营总览

#### Scenario: Switch primary page

- **WHEN** 用户选择管线、运行、Agent 或编排
- **THEN** 工作台只展示对应资源目录或工作面，不重复其他页面的目录

### Requirement: Visible domain context

工作台 MUST 提供全部、办公、研发、视觉领域筛选，并将该上下文应用到总览、Workflow Package、Run、Agent Profile 和 Graph；领域筛选不得隐藏在高级菜单中。

#### Scenario: Filter engineering context

- **WHEN** 用户选择研发
- **THEN** 总览、管线、运行、Agent 与编排列表只显示研发或跨领域资源

#### Scenario: Preserve domain context

- **WHEN** 用户从管线进入运行并返回
- **THEN** 原领域和列表筛选保持不变

### Requirement: Unified run directory

运行中心 MUST 统一展示 Daemon、Local Team Runtime、自动化触发和明确标记的兼容本地运行，并显示执行来源、状态、审批、失败原因、耗时和产物。兼容本地运行不得伪装成可恢复的正式运行。

#### Scenario: Review mixed execution sources

- **WHEN** 用户打开运行中心
- **THEN** 不同执行来源使用统一状态语义，并各自显示明确来源标签

#### Scenario: Reopen run room

- **WHEN** 用户选择可恢复运行
- **THEN** 工作台打开该运行的任务工作间并恢复状态、Graph、活动和产物

### Requirement: Actionable console states

工作台所有主要页面 MUST 覆盖 loading、empty、offline、degraded、permission 和 error 状态，并给出与状态一致的真实下一步；不得用成功样式表示等待、失败或取消。

#### Scenario: No runnable pipeline

- **WHEN** 当前领域没有可执行 Workflow Package
- **THEN** 空态说明缺失能力并提供配置、安装或切换领域入口

#### Scenario: Runtime offline

- **WHEN** 执行后端离线
- **THEN** 新建运行被 readiness 阻止，总览和详情提供就地诊断入口

