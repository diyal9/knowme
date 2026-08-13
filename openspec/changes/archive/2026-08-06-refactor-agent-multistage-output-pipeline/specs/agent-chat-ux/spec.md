## MODIFIED Requirements

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

## ADDED Requirements

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
