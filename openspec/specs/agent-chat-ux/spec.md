# agent-chat-ux Specification

## Purpose

定义工作台 Agent 对话的流式展示、Markdown 排版与协作动作，使体验贴近工作伙伴而非提示词编辑器。

## Requirements

### Requirement: Streaming assistant output

助手回复 MUST 通过版本化 Agent 输出协议展示；执行过程中 MUST 显示进行中指示和可读阶段状态。工具可用、grounding 或后处理可能改写正文时，临时模型正文 MUST 先缓冲，只有 canonical answer 才进入最终回答区。已经展示到对话中的 canonical 正文 MUST NOT 在收尾阶段被清空、隐藏、缩短、静默覆盖或从头重放。

#### Scenario: Buffered tool-capable round

- **WHEN** 模型轮可能继续调用工具或进入 grounding/后处理
- **THEN** 最终回答区不展示该轮临时正文
- **AND** 用户仍可在执行过程中看到阶段与工具进度

#### Scenario: Canonical answer commits

- **WHEN** Run 产生通过输出门禁的 canonical answer
- **THEN** 当前助手气泡正文更新为该答案并移除空白等待态
- **AND** 后续终态收尾不重新播放或替换正文

#### Scenario: Fallback when no provider stream

- **WHEN** 接口返回完整 canonical text 且未产生可展示流
- **THEN** 系统直接提交完整回复
- **AND** 不留下永久 streaming 状态或伪造 provider 流速

#### Scenario: User cancels an active run

- **WHEN** 用户在 Run 仍运行时点击停止
- **THEN** 助手消息进入 cancelled 状态并保留已经提交的 canonical 正文
- **AND** Renderer 不得显示 IPC 克隆错误或主进程内部对象

### Requirement: Assistant message uses a stable multi-region shell

每条实时助手消息 MUST 使用固定的执行过程、回答正文、结构化 UI 与动作区域；正常事件更新 MUST 只修改对应区域，MUST NOT 全量替换对话列表、历史消息、当前助手气泡或已经存在的正文容器。

#### Scenario: First progress event arrives

- **WHEN** 空助手消息收到首个 progress 或 tool 事件
- **THEN** 在现有助手气泡中更新执行过程区域
- **AND** 气泡节点身份保持不变

#### Scenario: Answer is committed

- **WHEN** 当前消息从 executing 转为 composing/completed
- **THEN** 在同一回答正文区域提交 canonical answer
- **AND** 执行过程与用户手动展开状态不因正文提交被重建

#### Scenario: Run completes

- **WHEN** 当前 Run 进入 completed、cancelled 或 error
- **THEN** 系统在现有消息节点上移除 busy 状态并追加终态动作
- **AND** 历史消息节点身份保持不变

### Requirement: Structured UI never exposes protocol text

结构化选择、审批参数和 thinking/suggestion JSON MUST 通过结构化 UI 区域展示；未闭合、非法、未通过动作白名单或尚未解析完成的协议内容 MUST NOT 出现在 Markdown 正文、代码块或纯文本尾中。

#### Scenario: Suggestion fence is still incomplete

- **WHEN** 缓冲正文包含未闭合 suggestion fence
- **THEN** 用户可见正文不包含 fence 或半截 JSON
- **AND** 系统可在结构化 UI 区显示非交互的「正在准备选项」状态

#### Scenario: Valid choice is ready

- **WHEN** suggestion 解析成功且动作全部通过白名单
- **THEN** 系统渲染可点击选择组件
- **AND** 正文只保留去除协议块后的 Markdown

#### Scenario: Invalid choice payload

- **WHEN** suggestion JSON 非法或没有合法选项
- **THEN** 系统忽略结构化块并记录诊断
- **AND** MUST NOT 把原始 JSON 回退显示给用户

### Requirement: User scroll priority survives all output lanes

发送新消息后系统 MUST 将当前会话定位到最新位置；生成期间用户主动滚动离开底部后，progress、tool、answer、ui 与 terminal 更新 MUST NOT 抢回滚动位置。

#### Scenario: User scrolls up during tool execution

- **WHEN** 用户在执行过程更新期间主动离开底部
- **THEN** 后续工具、答案和完成事件不强制滚到底部

#### Scenario: User returns near bottom

- **WHEN** 用户主动回到接近底部区域
- **THEN** 后续事件恢复跟随最新内容

### Requirement: Pre-stream thinking indicator

发送后到首包正文出现前，助手气泡 MUST 展示可读的等待态（文案「思考中…」及轻量动画）；MUST NOT 仅显示空白或孤立流式光标。首包或非空流式正文出现后，MUST 切换为正常流式展示并去掉等待文案。

#### Scenario: Show thinking while waiting

- **WHEN** 用户已发送消息且助手气泡仍无非空正文
- **THEN** 可见「思考中…」等待指示（含动画），且不以空光标作为唯一反馈

#### Scenario: Switch to streaming content

- **WHEN** 出现首个非空 stream chunk（或非空回退正文开始展示）
- **THEN** 「思考中…」消失，气泡展示流式正文与进行中指示（如光标）

#### Scenario: Error clears thinking

- **WHEN** 生成失败并展示错误气泡
- **THEN** 不再保留思考中等待态

### Requirement: Beautiful Markdown layout

助手气泡（流式结束后）MUST 以 Markdown 排版展示，至少支持标题、列表、行内代码、围栏代码块、粗斜体；样式 MUST 与工作台主题协调（可读间距、代码块背景区分）。

#### Scenario: Code fence readable

- **WHEN** 助手回复包含 Markdown 代码围栏
- **THEN** 气泡内代码块与正文区分显示，且内容正确转义防 XSS

#### Scenario: Streaming partial markdown

- **WHEN** 流式过程中存在未闭合代码围栏
- **THEN** 已闭合部分可按 MD 渲染，未闭合尾巴不以破坏布局的方式展示

### Requirement: Stable streaming paint

工作台 Agent 流式输出 MUST 只把已经闭合且可按最终样式渲染的内容写入用户可见区域；未完成 Markdown（表格、代码围栏、链接、强调、列表或半行）、JSON 与内部协议尾部 MUST 保留在内存缓冲，MUST NOT 先以原始文本显示后再替换为格式化节点。流式更新 SHOULD 合并到动画帧；仅在用户接近对话底部时自动滚动。流式完成时 MUST 在现有正文容器中格式化并提交剩余合法内容，MUST NOT 全量替换对话列表、当前气泡或正文容器。

#### Scenario: Incomplete tail stays buffered

- **WHEN** 最新流式内容以未完成半行、Markdown 结构、JSON 或协议片段结尾
- **THEN** 用户可见正文只包含此前已经稳定格式化的块
- **AND** 未完成尾部不以纯文本、代码块或转义源码显示
- **AND** 系统以低干扰生成状态说明回答仍在继续

#### Scenario: Stable block becomes visible

- **WHEN** 缓冲内容形成可稳定格式化的完整段落、标题、列表、表格、代码块或链接
- **THEN** 系统直接以最终展示样式将该块追加到当前正文区域
- **AND** 同一内容不存在原始文本到格式化节点的可见转换

#### Scenario: Stream updates coalesce

- **WHEN** 同一帧内到达多个 stream chunk
- **THEN** DOM 至多更新一次（rAF 合并）

#### Scenario: Final render matches full markdown

- **WHEN** 流式结束
- **THEN** 助手气泡在现有正文容器中使用完整 Markdown 渲染全部用户可见内容
- **AND** 已格式化内容、当前气泡与历史消息节点 MUST 保持原节点身份

#### Scenario: Completion decorates the existing bubble

- **WHEN** 当前助手回复由 streaming 转为完成
- **THEN** 系统 MUST 在现有气泡中移除生成状态并补充回答动作与状态元信息
- **AND** 当前正文容器 MUST NOT 因收尾被整体替换

### Requirement: Partner-oriented quick actions

Composer 快捷菜单（Ctrl+K）MUST 以协作动作为主（总结、改写、拆任务、检查歧义等），MUST NOT 仅提供「优化/扩展/精简/翻译提示词」四项。

#### Scenario: Menu copy

- **WHEN** 用户打开快捷操作菜单
- **THEN** 可见至少一项非「提示词」专用的协作动作

### Requirement: Bubble actions for partner workflow

助手气泡动作 MUST 提供「复制」；对需人审的 Artifact，MUST 提供进入右栏审阅的入口（或依赖同轮摘要卡），MUST NOT 将接受/拒绝作为气泡内唯一完整审阅 UI。独立笔记编辑器已退役；气泡 MUST NOT 提供「应用到文件」或插入光标 / 追加文末 / 替换全文；对文件的写入 MUST 走产物卡（`editor_patch`）人审。

#### Scenario: Copy always

- **WHEN** 助手回复完成且非空
- **THEN** 可见「复制」动作，点击后内容进入剪贴板

#### Scenario: No apply-to-file on completed reply

- **WHEN** 助手回复完成且非空
- **THEN** 气泡内不展示「应用到文件」
- **AND** 不展示插入光标、追加文末、替换全文

#### Scenario: Review entry for artifacts

- **WHEN** 本轮关联 draft Artifact
- **THEN** 用户可从气泡区或摘要卡进入右栏审阅，无需在窄气泡内读完全文才能接受

#### Scenario: File write stays on artifact card

- **WHEN** 本轮存在 `editor_patch` draft 产物
- **THEN** 用户仍可通过产物卡接受后写入目标文件

### Requirement: Suggestion / action bar in chat

工作台 Agent 助手回复若包含合法 `suggestion` 结构化块，客户端 MUST 渲染为可点击的建议/操作条；MUST NOT 依赖 Markdown 表格作为唯一交互暗示。动作 MUST 限于白名单（`fill` / `send` / `copy` / `open_knowledge` / `open_link`）。

#### Scenario: Render suggestion bar

- **WHEN** 助手完成回复且正文含合法 `suggestion` JSON 块（含 ≥1 有效 item）
- **THEN** 在该气泡可见建议条（标题可选 + 条目列表），条目可点击

#### Scenario: Fill composer

- **WHEN** 用户点击 `action: fill` 的条目
- **THEN** composer 填入 `payload` 文案并聚焦，不自动发送

#### Scenario: Send suggestion

- **WHEN** 用户点击 `action: send` 的条目
- **THEN** 以该 `payload` 作为用户消息发送（等价用户输入后发送）

#### Scenario: Copy suggestion

- **WHEN** 用户点击 `action: copy` 的条目
- **THEN** `payload` 进入剪贴板并有成功反馈

#### Scenario: Open knowledge

- **WHEN** 用户点击 `action: open_knowledge`
- **THEN** 打开知识库全页（与左侧书本入口一致）

#### Scenario: Invalid block ignored safely

- **WHEN** suggestion 块 JSON 非法或无有效 item
- **THEN** 不渲染建议条、不抛未捕获错误；其余 Markdown 仍可展示

#### Scenario: Unknown action skipped

- **WHEN** 某 item 的 `action` 不在白名单
- **THEN** 跳过该 item，其它合法 item 仍展示

#### Scenario: Streaming holds incomplete suggestion fence

- **WHEN** 流式过程中 `suggestion` 围栏未闭合
- **THEN** 不以半截 JSON 渲染可点条；闭合或流式结束后再渲染

### Requirement: Replace requires authorization

通过产物卡发起的「替换全文」MUST NOT 立即改写编辑器；MUST 先产生待审阅提案（`editor_patch` draft），用户接受后才应用。气泡内 MUST NOT 提供直接替换入口。

#### Scenario: Propose replace via artifact

- **WHEN** 用户从产物卡发起替换全文且存在活动文件
- **THEN** 出现 draft 产物卡（或等价确认 UI），编辑器内容尚未被替换

#### Scenario: Accept replace

- **WHEN** 用户接受该提案
- **THEN** 当前编辑器全文被替换为提案正文，产物状态为 accepted，并有成功反馈

#### Scenario: Reject replace

- **WHEN** 用户拒绝提案
- **THEN** 编辑器不变，产物状态为 rejected

### Requirement: Low-risk apply with feedback

插入光标与追加文末 MAY 一键应用，但 MUST 提供 toast（或等价）成功/失败反馈，并 MUST 留下可感知的操作轨迹说明。

#### Scenario: Insert feedback

- **WHEN** 用户执行插入光标成功
- **THEN** 可见成功提示，且对话区出现轨迹说明（如「已插入到当前文件」）

### Requirement: 办公搭档空态文案与对齐

系统 MUST 在默认 Agent 空态展示清晰、可行动的办公入口文案，并与卡片左缘对齐。

#### Scenario: 标题与卡片左对齐

- **WHEN** 用户打开默认 Agent 空态
- **THEN** 标题显示「智能办公搭档」，且与下方 2×2 卡片左缘对齐

#### Scenario: 会议总结卡片

- **WHEN** 用户查看会议总结入口
- **THEN** 标题为「会议总结」，小标题为「为我总结最近三天的会议」

#### Scenario: 相关聊天卡片

- **WHEN** 用户点击「分析跟我相关的聊天」
- **THEN** 系统触发飞书相关聊天分析流程，优先汇总 @我 的内容

### Requirement: Steward empty state shares office-home layout

知识管家 Session 对话为空时，空状态 MUST 复用通用助手的宽版任务入口样式（`agent-empty-home`），同时保留知识管家专属任务模板。

#### Scenario: 知识管家空状态视觉对齐

- **GIVEN** 当前 Session 为知识管家且对话为空
- **WHEN** 渲染空状态
- **THEN** 容器带有 `agent-empty-home`
- **AND** 仍提供 ingest / lint / promote / remote-rag 四项任务按钮
- **AND** MUST NOT 渲染旧版快捷提示行（`agent-empty-tip`）

#### Scenario: 知识管家任务仍可触发

- **GIVEN** 知识管家空状态已展示
- **WHEN** 用户点击任一 `data-steward` 按钮
- **THEN** 系统调用既有 `runStewardTemplate` 流程

### Requirement: Related chats result fills message track

相关聊天结果正文 MUST 铺满共享消息轨道宽度，MUST NOT 额外施加窄于外层气泡的内层宽度上限。

#### Scenario: 结果正文与执行过程同宽

- **WHEN** 助手气泡带有 `related-chats-result` 且展示会话列表
- **THEN** `.agent-md` 宽度为 `100%`，与同气泡内「执行过程」横条左右对齐

### Requirement: Composer send button reflects running state

Agent 对话输入框的发送按钮 MUST 在助手生成过程中切换为停止图标，并在结束后恢复发送图标。

#### Scenario: Enter running state

- **WHEN** 用户发送一条消息且助手开始生成
- **THEN** `#agentSend` 显示为黑色圆形按钮、中心白色圆角 `stop` 方块，title/aria-label 为「停止生成」

#### Scenario: Leave running state

- **WHEN** 生成完成、出错或用户取消
- **THEN** `#agentSend` 图标恢复为 `send`，title/aria-label 为「发送」

#### Scenario: Cancel still works

- **WHEN** 生成中用户再次点击发送按钮
- **THEN** 仍触发现有取消逻辑（图标变化不改变取消语义）

### Requirement: 对话滚动条按需显示

Agent 对话内容区 MUST 仅在用户将鼠标移入该区域时显示滚动条滑块。

#### Scenario: 鼠标位于对话内容区外

- **WHEN** 对话内容产生纵向溢出且鼠标不在对话内容区内
- **THEN** 右侧滚动条滑块不可见
- **AND** 对话仍可通过鼠标滚轮或触控板滚动

#### Scenario: 鼠标进入对话内容区

- **WHEN** 对话内容产生纵向溢出且鼠标进入对话内容区
- **THEN** 右侧滚动条滑块可见
- **AND** 用户可以拖动滑块定位长对话

#### Scenario: 鼠标离开对话内容区

- **WHEN** 可见滚动条的对话内容区失去鼠标悬停
- **THEN** 滚动条滑块重新隐藏
- **AND** 对话内容宽度和布局保持不变

### Requirement: 助手入口标题居中

使用通用助手入口布局的空状态页 MUST 将主标题与副标题水平居中，同时 MUST 保持任务卡片内容左对齐。Agent 输入区 MUST 不显示输入框上方的外层横向分隔线，并 MUST 保留输入框自身边框。

#### Scenario: 知识管家入口

- **WHEN** 用户打开知识管家的空会话
- **THEN** “公司知识协作”及其副标题居中显示
- **AND** 下方知识任务卡片文字保持左对齐

#### Scenario: 智能办公搭档入口

- **WHEN** 用户打开智能办公搭档的空会话
- **THEN** “智能办公搭档”及其副标题居中显示
- **AND** 下方办公任务卡片文字保持左对齐

#### Scenario: 输入区视觉边界

- **WHEN** 用户查看 Agent 输入区
- **THEN** 输入框上方不显示横向分隔线
- **AND** 输入框自身边框保持可见

### Requirement: Composer 模型控件可读且可切换

Agent composer MUST 展示可读的当前模型名；点击后弹出纵向分组菜单；常态 MUST NOT 显示 used/limit Token 数字，压缩时 MUST 提示「已压缩」并可查看占用分区。

#### Scenario: model picker visible

- **WHEN** 用户打开 Agent composer
- **THEN** 工具栏显示带模型名的模型控件（非仅圆环）

#### Scenario: model menu opens and switches

- **WHEN** 用户点击模型控件并选择另一模型
- **THEN** 标签更新并在下一回合使用新模型

#### Scenario: token usage hidden until compaction

- **WHEN** 未发生上下文压缩
- **THEN** 模型按钮 MUST NOT 显示 `已用/上限` Token 数字
- **AND** 发生压缩时可显示「已压缩」并查看分区

### Requirement: Suggestion open_link action

建议条动作白名单 MUST 包含 `open_link`；合法 URL 打开链接，非法 URL 报错且 MUST NOT 打开知识库。

#### Scenario: Open link

- **WHEN** 用户点击 `action: open_link` 且 payload 为合法 URL
- **THEN** 打开该链接（飞书链接走飞书客户端）
- **AND** MUST NOT 打开知识库全页


### Requirement: Industry-flavored empty today-priority examples

当「今日优先级」判定飞书日程与未完成待办均为空时，助手 UI MUST 用当前行业 catalog 确定性改写正文：说明无可用飞书事实、请用户提供 1 个真实工作目标，并给出最多 3 条占位示例；MUST 标明示例不是真实任务；MUST NOT 展示模型生成的 suggestion 选项栏。

#### Scenario: Game industry empty facts

- **WHEN** 用户行业为 `game` 且今日优先级工具结果日程/待办均为 0
- **THEN** 展示正文包含游戏向占位示例（如数值表/活动配置/版本风险），且不含销售合同签署类示例

#### Scenario: General industry empty facts

- **WHEN** 用户行业为 `general` 且同上空事实
- **THEN** 展示中性办公占位示例

#### Scenario: Non-empty Feishu facts unchanged

- **WHEN** 今日优先级工具返回非空日程或待办
- **THEN** 不使用空态占位模板，正常展示模型基于事实的 Top3 输出

### Requirement: Streaming markdown repaints incrementally

系统 MUST 在流式渲染 Markdown 时只更新变化的稳定块级节点与固定生成状态，MUST NOT 把未完成模型尾部写入 DOM，MUST NOT 每帧整体替换 `.chat-text` 容器。

#### Scenario: Text continues on the same line

- **GIVEN** 助手正在输出，且新增内容仍在未闭合的尾行
- **WHEN** 新的 chunk 到达并触发重绘
- **THEN** 系统 MUST 复用固定生成状态且不把新增尾行文本写入 DOM
- **AND** 已渲染的段落 / 表格 / 链接卡片节点 MUST 保持同一节点身份

#### Scenario: A stable block is finalized

- **GIVEN** 尾行完成并进入稳定区
- **WHEN** 重绘发生
- **THEN** 系统 MUST 直接插入最终格式的新增块级节点并移除或后移生成状态，其余节点保持不变

### Requirement: First token upgrades the thinking bubble in place

系统 MUST 在首个正文 token 到达时就地把「思考中」气泡升级为正文气泡，MUST NOT 触发整个会话列表的全量重绘。

#### Scenario: First content token arrives

- **GIVEN** 助手气泡处于思考态（无正文）
- **WHEN** 第一个正文 token 到达
- **THEN** 系统 MUST 在同一气泡节点内移除思考态指示并插入正文容器
- **AND** 会话中其他消息的 DOM 节点 MUST 保持不变

### Requirement: Task cards run a deterministic preflight before invoking the model

系统 MUST 在四模式任务卡片发送前做确定性准入判断；当必需内容缺失时 MUST 用一句固定文案询问，MUST NOT 在缺内容时调用 LLM 生成回答。

#### Scenario: Missing material for writing or coding task

- **GIVEN** 用户处于写作或编程模式且输入框为空、未选附件
- **WHEN** 用户点击需要素材的任务卡片（如"写办公文档""解释代码"）
- **THEN** 系统 MUST 在聊天区推送一句话询问所需素材
- **AND** MUST NOT 调用 LLM，也 MUST NOT 产出任何任务结果
- **AND** MUST 暂存该任务，聚焦输入框

#### Scenario: Missing Feishu authorization for connector task

- **GIVEN** 飞书连接器未启用或 user 身份未授权
- **WHEN** 用户点击依赖飞书的通用任务卡片（会议总结 / 今日优先级 / 查文档知识库 / 分析相关聊天）
- **THEN** 系统 MUST 一句话提示前往"设置 → 连接器"授权飞书
- **AND** MUST NOT 调用 LLM

#### Scenario: Resume task after providing material

- **GIVEN** 系统因缺素材已一句话询问并暂存了某任务
- **WHEN** 用户在输入框补齐素材后直接发送
- **THEN** 系统 MUST 自动带上原任务指令继续执行，无需再次点击卡片
- **AND** 用户提供的素材 MUST 被并入任务 prompt

#### Scenario: Preconditions satisfied

- **GIVEN** 素材已就绪或飞书已授权
- **WHEN** 用户点击对应任务卡片
- **THEN** 系统 MUST 走增强执行路径直接开工，不做多余追问

### Requirement: Empty-state cards and quick menu share one preflight path

系统 MUST 让空态卡片与快捷菜单在触发同一任务时，走一致的准入与执行路径。

#### Scenario: Quick menu triggers a known task

- **GIVEN** 用户通过 `Ctrl/Cmd+K` 快捷菜单触发某个已登记任务
- **WHEN** 该任务命中 preflight 配置
- **THEN** 系统 MUST 复用与空态卡片相同的一句话询问与增强执行逻辑

### Requirement: Writing mode uses task-oriented quick actions

写作模式的空态卡片和快捷菜单 MUST 以文档任务为中心，而不是以提示词编辑为中心。

#### Scenario: Writing quick menu

- **GIVEN** 用户处于写作模式
- **WHEN** 打开 `Ctrl/Cmd+K` 快捷菜单
- **THEN** 用户能看到“写需求文档”“写办公文档”“按提纲成稿”“排版定稿”“润色去 AI 味”等动作
- **AND** 这些动作与空态卡片表达同一套任务心智

### Requirement: Long writing drafts open in review surface

写作模式生成的长文稿 MUST 默认进入右侧审阅区，而不是只留在聊天气泡内。

#### Scenario: Long output becomes draft

- **GIVEN** 用户触发写作任务且输出为长文稿
- **WHEN** 助手完成生成
- **THEN** 系统创建 draft artifact 并提供进入右侧审阅的入口
- **AND** 审阅区中能看到“写入当前编辑器”和“生成飞书文档草稿”等后续动作

### Requirement: Writing output removes common AI tone by default

写作模式的最终输出 MUST 默认做去 AI 味后处理，同时保留事实、术语和结构。

#### Scenario: Requirement doc keeps structure

- **GIVEN** 用户在写作模式中生成需求文档
- **WHEN** 返回最终文稿
- **THEN** 文稿结构清晰，保留验收、边界、风险等专业内容
- **AND** 减少空泛拔高、宣传腔和高频 AI 套话

### Requirement: Composer 旁不展示记忆勾选条

Agent 输入框上方 MUST NOT 渲染工作提示 / 「本轮带上」勾选条，直至产品明确意图推荐或记忆开关的定位。

#### Scenario: 打开对话时输入区干净

- **WHEN** 用户打开 Agent 对话且输入框为空
- **THEN** 输入框上方不出现记忆相关勾选芯片

#### Scenario: 记忆仍可静默进入请求

- **WHEN** 用户已有已确认习惯或设置了协作偏好，并发送一条消息
- **THEN** 主进程仍可通过个性化 / 协作偏好链路注入上下文
- **AND** 渲染进程不提供本轮勾选开关

### Requirement: 静默生效且可解释

助手回复 SHALL 在有个性化注入时提供低干扰说明，MUST NOT 恢复输入框旁记忆勾选条。

#### Scenario: 回复旁提示沿用习惯

- **WHEN** 本轮实际注入了至少 1 条已确认习惯或手填偏好
- **THEN** 该条助手消息附近展示「本轮沿用了你的习惯」类提示
- **AND** 用户可展开查看具体条目

#### Scenario: 无个性化时不打扰

- **WHEN** 本轮未注入任何个性化条目
- **THEN** MUST NOT 展示空的沿用提示

### Requirement: Honest read and verify status in assistant surface

助手气泡区域 MUST 诚实展示读取/验证状态与来源：verified、pending、blocked、failed。MUST NOT 在无 ToolLedger ok 与 verified claims 时展示「已读取」「已同步」等绿色成功态徽章或等价误导文案。

#### Scenario: No false read badge without ledger

- **WHEN** 助手输出总结但 ToolLedger 无 required read ok
- **THEN** UI MUST NOT 显示「已读取」成功徽章
- **AND** MUST 显示 pending 或 blocked 说明

#### Scenario: Verified summary shows sources affordance

- **WHEN** claims 通过 verifier 且含 evidenceIds
- **THEN** 助手气泡 MUST 提供「查看来源」或等价入口
- **AND** 来源列表 MUST 与 ledger provenance 一致

#### Scenario: Blocked output shows next step not fake facts

- **WHEN** OutputGate blocked 编造事实
- **THEN** 用户可见文案 MUST 说明需先调用何工具或澄清何选项
- **AND** MUST NOT 同时展示编造议题/日期/责任人

### Requirement: Structured selection UI aligns with ReferenceState

当展示候选列表（会议、文档等）时，UI MUST 与 ReferenceState pendingSelection 同步；用户点选或回复序号 MUST 走 structured binding 路径。

#### Scenario: Click candidate binds ref without NL-only path

- **WHEN** 用户点击候选卡片或发送序号
- **THEN** 系统 MUST 更新 ReferenceState 绑定
- **AND** MUST NOT 仅把「2」作为裸 prompt 传给模型而无 binding 事件
