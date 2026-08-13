## MODIFIED Requirements

### Requirement: Streaming assistant output

助手回复 MUST 以流式方式展示（订阅 `ai-stream-chunk`）；流式过程中 MUST 显示进行中指示（如光标）；结束后 MUST 去掉进行中指示。已经展示到对话中的正文 MUST NOT 在收尾阶段被清空、隐藏或从头重放。

#### Scenario: Chunks update bubble

- **WHEN** 模型开始流式返回
- **THEN** 当前助手气泡文本随 chunk 增长更新，无需等整段结束后才出现正文

#### Scenario: Fallback when no stream

- **WHEN** 接口返回完整文本且未产生任何非空 stream chunk
- **THEN** 仍展示完整回复（可用轻量打字或直接落盘），且不留下永久 streaming 状态

#### Scenario: Single flush already painted

- **WHEN** 流式通道只返回一次非空完整正文且该正文已显示
- **THEN** 收尾阶段 MUST 保留当前正文
- **AND** MUST NOT 清空后执行打字机重放

#### Scenario: User cancels an active run

- **WHEN** 用户在 `ai-generate` 仍运行时点击停止
- **THEN** 主进程 MUST 仅返回可结构化克隆的公开取消字段
- **AND** Renderer MUST 收到正常取消结果，不得显示 `An object could not be cloned`

### Requirement: Stable streaming paint

工作台 Agent 流式输出 MUST 避免因未完成 Markdown（表格/围栏/半行）频繁整树重排造成的明显闪屏；流式更新 SHOULD 合并到动画帧；仅在用户接近对话底部时自动滚动。流式完成时 MUST 局部完成当前助手气泡，MUST NOT 全量替换对话列表或已经显示的正文容器。

#### Scenario: Incomplete table stays in plain tail

- **WHEN** 流式正文末尾为尚未以空行结束的 Markdown 表格行
- **THEN** 这些行以纯文本尾展示，不反复重建完整 `<table>`，直至表格块稳定或流式结束

#### Scenario: Stream updates coalesce

- **WHEN** 同一帧内到达多个 stream chunk
- **THEN** DOM 至多更新一次（rAF 合并）

#### Scenario: Final render matches full markdown

- **WHEN** 流式结束
- **THEN** 助手气泡使用完整 Markdown 渲染（与非流式一致），含表格
- **AND** 既有历史消息节点 MUST 保持原节点身份

#### Scenario: Completion decorates the existing bubble

- **WHEN** 当前助手回复由 streaming 转为完成
- **THEN** 系统 MUST 在现有气泡中移除流式光标并补充回答动作与状态元信息
- **AND** 当前正文容器 MUST NOT 因收尾被整体替换
