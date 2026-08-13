---
name: feishu-meeting-summary
description: >-
  检索飞书妙记会议候选，用户选定后读取正文并输出结构化会议总结。Use when the user asks
  for meeting summary, meeting minutes, or Feishu 妙记 recap.
slash: /feishu-meeting-summary
version: 1.0.0
disable-model-invocation: true
requiredTools: [feishu.meeting_candidates, feishu.meeting_read]
---

# 飞书会议总结

## 何时使用

- 用户要「会议总结」「会议纪要」「妙记总结」
- KnowMe 空态或快捷菜单触发 `meetingSummary` 任务

## 时间范围

- 默认统计 **最近 3 个自然日（含今天）** 与用户相关的会议
- 会议范围：用户作为组织者、参会人、被 @ 提及或会后待办责任人的记录
- 若任务声明其他天数，传给 `feishu.meeting_candidates` 的 `days`（1–30）

## 两阶段工作流（必须遵守）

### 阶段一：候选列表（首轮）

1. 确认飞书 user 授权；未授权时提示授权，**不要编造会议**
2. 调用 `feishu.meeting_candidates`（`days` 见上）拉取候选
3. **仅展示候选会议列表**：
   - 每场会议只显示 **一张可打开的飞书妙记卡片**
   - 会议标题、日期时间、组织者全部放在卡片内
   - 卡片外不重复展示
   - **不显示**原始 `minute_token` / url
4. **不要**直接读取正文、**不要**直接总结
5. 若首轮为 0 条：先自动放宽关键词再检索一轮；仍为 0 则诚实说明「最近 N 天没有找到相关会议」，可附可选下一步（换时间范围或指定主题）。**不要**罗列可能原因，**不要**请求粘贴链接
6. 若接口错误（Internal error / 请重试 / 服务器繁忙）：只回一句「飞书接口暂时故障，请稍后再试」。**严禁**粘贴原始报错 JSON、log_id、堆栈

### 阶段二：用户选定后总结

1. 等用户选择具体会议（序号或卡片）
2. 调用 `feishu.meeting_read` 读取该场妙记正文
3. 读取成功后再输出结构化总结：

```markdown
### 会议标题｜时间
- 议题
- 结论
- 待办（责任人、时间点如有）
- 与我相关 / 风险阻塞 / 建议下一步（各一句）
```

4. 权限失败：诚实说明「没有该妙记的查看权限」，**不要编造正文**；可提示申请权限或用户自行申请后重试
5. **禁止编造**未读取正文中的事实

## 禁止事项

- 不要用 `feishu.search_docs` 替代会议工具
- 不要在阶段一调用 `feishu.meeting_read`
- 不要中途让用户回复序号后继续（阶段一仅展示，阶段二等用户明确选择）

## 零候选与权限

- 0 候选：如实说明，不编造会议
- 读取权限错误：跳过或说明真实原因，不伪造总结内容
