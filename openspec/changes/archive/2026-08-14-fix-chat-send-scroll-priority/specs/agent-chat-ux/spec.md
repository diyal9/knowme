## ADDED Requirements

### Requirement: Send forces chat to latest

用户每次主动发送新消息后，对话内容区 MUST 滚动到最新位置（最新用户气泡及随后的助手思考/流式气泡可见），无论发送前滚动位置是否远离底部。

#### Scenario: Send while scrolled up

- **WHEN** 用户已上滑阅读历史内容，并点击发送或按 Enter 发送一条新消息
- **THEN** 对话区滚动到最新位置，可见刚发出的用户气泡与助手等待/流式态

#### Scenario: Shortcut or suggestion send

- **WHEN** 用户通过快捷任务或建议条 `send` 触发等价发送
- **THEN** 行为与手动发送一致，对话区滚到最新位置

### Requirement: User scroll wins during generation

助手生成 / 流式更新期间，若用户主动滚动离开底部，系统 MUST NOT 因内容增高把视口拽回底部；当用户再次滚到接近底部时，MUST 恢复自动跟随。

#### Scenario: Scroll up during stream

- **WHEN** 助手正在流式输出且用户上滑离开接近底部区域
- **THEN** 后续 chunk / 重绘 MUST NOT 强制滚动到底部

#### Scenario: Return to bottom resumes follow

- **WHEN** 用户在生成过程中自行滚回接近底部
- **THEN** 后续流式更新恢复自动滚到底部

## MODIFIED Requirements

### Requirement: Stable streaming paint

工作台 Agent 流式输出 MUST 避免因未完成 Markdown（表格/围栏/半行）频繁整树重排造成的明显闪屏；流式更新 SHOULD 合并到动画帧；仅在用户接近对话底部（或本轮发送后仍 stick-to-bottom）时自动滚动；用户主动上滑离开底部后 MUST NOT 抢滚动焦点，直至再次接近底部或再次发送。

#### Scenario: Incomplete table stays in plain tail

- **WHEN** 流式正文末尾为尚未以空行结束的 Markdown 表格行
- **THEN** 这些行以纯文本尾展示，不反复重建完整 `<table>`，直至表格块稳定或流式结束

#### Scenario: Stream updates coalesce

- **WHEN** 同一帧内到达多个 stream chunk
- **THEN** DOM 至多更新一次（rAF 合并）

#### Scenario: Final render matches full markdown

- **WHEN** 流式结束
- **THEN** 助手气泡使用完整 Markdown 渲染（与非流式一致），含表格

#### Scenario: Near-bottom follows stream

- **WHEN** 用户视口接近对话底部且助手流式输出增长
- **THEN** 对话区自动跟随滚到底部

#### Scenario: Away-from-bottom does not follow stream

- **WHEN** 用户视口已离开接近底部区域且助手流式输出增长
- **THEN** 对话区保持用户当前阅读位置，不强制滚底
