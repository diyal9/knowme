# feishu-im Specification

## Purpose

定义飞书即时消息相关的只读 Workflow，供办公搭档汇总 @我 与近期会话。

## Requirements

### Requirement: 飞书相关聊天 Workflow

系统 MUST 提供确定性只读工具 `feishu.related_chats`，用于汇总与当前用户相关的聊天。

#### Scenario: 默认今天并含私聊群聊主题

- **WHEN** Agent 调用 `feishu.related_chats`（未指定 days 或 days=1）
- **THEN** 系统按最近 1 个自然日（今天）用 `im +messages-search --is-at-me` 读取 @我
- **AND** 用 `im +chat-list --types p2p,group --sort active_time` 补充私聊与群聊主题
- **AND** 返回可读摘要，禁止发送消息

#### Scenario: grounding 不误判为会议文档

- **WHEN** 用户意图为「分析跟我相关的聊天」且 `feishu.related_chats` 已成功返回
- **THEN** 系统 MUST NOT 用「请提供文档链接或 token / 会议内容结论」替换回答

#### Scenario: 长会话结果可快速扫读

- **WHEN** 相关聊天结果包含多条私聊、群聊或话题群
- **THEN** 结果 MUST 以摘要、一级分区和会话条目呈现
- **AND** 正文限制在适合桌面阅读的宽度，私聊与群聊具有明确分组
- **AND** 常见的编号式标题输出 MUST 被归一化为语义标题，不呈现为连续日志

### Requirement: 相关聊天可跳转飞书会话

系统 MUST 为 `feishu.related_chats` 返回的私聊与群聊提供可打开的飞书会话链接。

#### Scenario: 会话名带 openChatId 深链

- **WHEN** `related_chats` 列出带 `chat_id`（`oc_` 前缀）的会话或 @我 消息
- **THEN** 摘要 MUST 包含 `https://applink.feishu.cn/client/chat/open?openChatId=<chat_id>` 形式的 Markdown 链接
- **AND** 用户点击链接 MUST 通过现有 `openExternal` 打开飞书会话

#### Scenario: 直达飞书客户端，不经浏览器中转

- **WHEN** 用户点击 `applink.feishu.cn` / `applink.larksuite.com` 形式的会话链接
- **AND** 本机已注册对应客户端协议（`feishu://` / `lark://`）
- **THEN** 系统 MUST 直接用客户端协议唤起飞书，MUST NOT 先打开浏览器再跳转
- **AND** 未注册客户端协议时 MUST 回退到原 https 链接，保持可用
- **AND** 非 AppLink 的飞书文档链接（如 `/minutes/<token>`）MUST 保持现有浏览器打开行为

### Requirement: 消息主题提炼与处理建议

系统 MUST 对需阅读的 @我 消息做清洗与主题提炼，并给出处理建议。

#### Scenario: @我 不以原文噪声展示

- **WHEN** 消息正文含 `<at>`、表情码或其它标记
- **THEN** 工具摘要 MUST 输出清洗后的要点，不得原样倾倒标签
- **AND** 每条 MUST 含主题提示与建议处理
- **AND** 「在飞书打开」仅为次要动作，用于需要阅读完整上下文时
