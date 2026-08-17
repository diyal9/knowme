## ADDED Requirements

### Requirement: 快捷指令用户气泡显示短标题

助理会话中，若用户消息正文匹配基线快捷指令泄漏特征（阶段说明、`feishu.*` 工具名、搭档规则等），气泡 MUST 显示压缩短标题（例如「会议总结」），MUST NOT 把内部指令全文铺在对话里。发给模型的 `prompt` MUST 仍是完整指令。

#### Scenario: 会议总结快捷只显示短标题

- **WHEN** 用户通过 Ctrl+K 或空态卡发送「会议总结」完整 prompt
- **THEN** 用户气泡文案为「会议总结」，且 `aiGenerate` 的 `prompt` 仍包含 `feishu.meeting_read`

### Requirement: 生成中立即展示友好执行进度

发送后当前助手消息 MUST 立刻带有 `stage_prepare` 时间线（或等价执行进度），过程标题 MUST 使用友好文案（「正在整理相关内容」），MUST 显示已等待时长。页面 MUST NOT 在整轮结束前只剩内部文案「正在准备上下文…」小胶囊。

#### Scenario: 发送后尚未收到模型 token

- **WHEN** 用户发送任意非空消息且助手仍在 streaming、尚无正文
- **THEN** 可见执行进度，标题含「正在整理相关内容」或后续 stage 友好文案，并含耗时

### Requirement: 流式过程事件在生成中更新气泡

渲染层 MUST 将 `ai-stream-event` 的扁平 stage 与带 `version` 的 v2 envelope 归约到当前助手消息的 `trace` / 已提交正文。v2 消息 MUST NOT 用 `ai-stream-chunk` 覆盖已提交正文。

#### Scenario: 上下文准备完成写入时间线

- **WHEN** 收到 `stage` 且标题为「上下文准备完成」
- **THEN** 当前助手气泡执行进度出现「内容整理完成」，且没有「返回工作台」过程卡

### Requirement: invoke 完成时仍能得到正文

`ai-generate` 的 kernel 路径 MUST 在成功时回传已提交正文（`text`），供渲染层在 `answer.committed` 晚于 invoke 回包时落字。渲染层 MUST 在 detach 流监听前短 flush 事件队列。仅当既无 committed 正文、invoke 也无 `text` 时，才显示「未能收到完整答复，请重试。」；该错误态 MUST NOT 展示追问建议条。

#### Scenario: 你好得到模型答复

- **WHEN** 用户发送「你好」且 kernel 成功提交回答
- **THEN** 助手气泡出现正文，MUST NOT 只显示「未能收到完整答复，请重试。」

#### Scenario: 晚到的 answer.committed 仍落字

- **WHEN** `aiGenerate` invoke 已返回但 `answer.committed` 仍在事件队列
- **THEN** 助手气泡仍写入 committed 正文

### Requirement: 助手正文按 Markdown 排版

助手气泡 MUST 把模型正文渲染为 HTML（加粗、列表、标题、代码），MUST NOT 把 `**bold**` 或 `1. ` 源码当纯文本铺开。渲染 MUST 走渲染层可用的 Markdown 实现，不得依赖 Vite 无法展开的 CJS IIFE `markdown-lite.render`。

#### Scenario: 有序列表与加粗可见

- **WHEN** 助手正文为 `1. **Data Server Host**` 换行 `2. **Dynamic Skill Hit**`
- **THEN** 气泡内为有序列表，词条为粗体，页面上看不到字面量 `**`
