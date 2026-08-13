---
name: feishu-today-priority
description: >-
  拉取飞书今日日程、待办与 @我 信号，基于事实输出最多 3 项优先级行动。Use when the user
  asks for today priority, Top3 tasks, or daily focus from Feishu calendar/tasks.
slash: /feishu-today-priority
version: 1.0.0
disable-model-invocation: true
requiredTools: [feishu.today_priority]
---

# 飞书今日优先级

## 何时使用

- 用户要「今日优先级」「今天先做什么」「Top3」
- KnowMe 空态或快捷菜单触发 `todayPriority` 任务

## 时间范围

- **仅统计今天**（执行时刻所在自然日）
- 不要扩展到其他 Workflow（会议文档、相关聊天）

## 执行步骤

1. 确认飞书 user 授权（含 calendar / task scope）；未授权时提示授权，**不要臆造日程或待办**
2. 调用 `feishu.today_priority`（可传 `include_mentions=true`）拉取：
   - 今日日程
   - 未完成待办
   - 今日 @我 阻塞信号
3. 拿到工具结果后 **立刻** 输出最多 3 件事

## 输出契约

```markdown
## 现在先做这 3 件事
### 1. …
- 优先级理由：（引用工具中的日程/待办/@我）
- 预计耗时：…
- 第一步动作：…
### 2. …
### 3. …
```

### 排序规则

已过期待办 > 今日硬截止/会议前必须完成 > 会议准备 > 其余待办

### 追问限制

- **禁止**先问截止时间/影响范围/当前阻塞等多项澄清
- 仅当日程与待办都为空、或关键冲突无法判断时，**最多追问 1 句**（合并成一句）

### 空事实处理

当日程与待办都为空时：

1. 如实说明「当前没有可用的飞书事实」
2. 询问用户提供 **1 个真实工作目标**
3. 可给出最多 3 条 **行业占位示例**（须声明仅为示例格式、不是真实任务）
4. **禁止**把示例写成推荐任务、禁止编造用户真实项目名
5. **禁止**输出「选一项」列表、按钮选项或 ` ```suggestion JSON ``` `

## 禁止事项

- 禁止编造未出现在工具结果中的事实
- 禁止索要文档链接或 token
- 禁止用会议总结 / 相关聊天 Workflow 替代本任务
