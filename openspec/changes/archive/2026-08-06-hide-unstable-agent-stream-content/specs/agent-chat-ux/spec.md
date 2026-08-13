## MODIFIED Requirements

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
