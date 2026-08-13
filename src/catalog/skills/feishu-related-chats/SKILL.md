---
name: feishu-related-chats
description: >-
  分析飞书私聊/群聊中与用户相关的会话主题、@我 消息与待回应事项。Use when the user asks
  about related chats, @mentions, unread messages, or today's IM topics via Feishu.
slash: /feishu-related-chats
version: 1.0.0
disable-model-invocation: true
requiredTools: [feishu.related_chats]
---

# 飞书相关聊天

## 何时使用

- 用户要分析「跟我相关的聊天」「@我」「未读」「今天私聊/群聊主题」
- KnowMe 空态或快捷菜单触发 `relatedChats` 任务

## 时间范围

- 默认统计 **今天（1 个自然日，含今天）**
- 若用户或任务声明指定天数，使用 `feishu.related_chats` 的 `days` 参数（1–30）
- 时间范围以执行时刻为准，不要臆造日期

## 执行步骤

1. 确认飞书 **user 身份**已授权；未授权时提示完成授权，**禁止臆造聊天内容**
2. 调用 `feishu.related_chats`（`days` 见上）读取授权账号可见的私聊/群聊主题与 @我 消息
3. 按下方输出契约整理结果

## 输出契约

用简洁 Markdown 分区输出，不要写成长段日志或原文 dump：

```markdown
## 今日相关会话主题（总数）
### 私聊（数量）
- `私聊` [会话名](https://applink.feishu.cn/client/chat/open?openChatId=...)
### 群聊 / 话题群（数量）
- `群聊` [会话名](https://applink.feishu.cn/client/chat/open?openChatId=...)
## @我 的消息（数量）
### N. [会话名](飞书会话链接)
- 发送人 · 时间
- 主题：一句话提炼（禁止保留 `<at>`、表情码等原始标记）
- 建议处理：用户该怎么做
- 需要全文时：[在飞书打开原文](链接)（次要动作，非默认必读）
## 待我回应 / 需跟进事项
- 事项
## 建议下一步
- 是否回复、是否拉会对齐
```

### 风格

- 克制专业：默认 **不使用 emoji 或装饰性图标**
- 状态标签仅用纯文本：`[需确认]`、`[高优先级]`、`[可延后]`
- 不要堆叠图标或高情绪化表达

### 硬性约束

1. 每个私聊/群聊会话名 **MUST** 保留为可点击 Markdown 链接（使用工具给出的 openChatId 链接），禁止改成纯文本
2. 凡涉及消息的条目 **MUST** 先总结主题并给出处理建议，不要粘贴长原文
3. 只有用户需要核对完整上下文时，才提示点击飞书打开；不要把「打开飞书」当成每条的主操作
4. **禁止编造**未出现在工具结果中的聊天内容；0 条时如实说明并建议扩大天数或指定群名
5. **禁止**走会议文档/妙记路径，禁止索要文档 token
6. **禁止**调用 `feishu.meeting_candidates`、`feishu.meeting_read`、`feishu.search_docs` 替代本任务
7. **禁止**读取飞书文档正文

## 零结果与错误

- 0 条会话：如实说明，给出扩大时间范围或指定群名的下一步
- 权限/接口错误：返回真实原因，不要编造聊天内容
