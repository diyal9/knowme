# Proposal: feishu-just-in-time-auth

> 从 `office-partner-grounded-connectors` 拆分出的独立可交付切片。原大 change 保留 GitHub/网页内容源、润色链路等未完成任务。

## Why

飞书连接器即便已启用、user 已授权，只要 lark-cli 报告缺某个具体 scope（例如读取个人文档所需的 `space:document:retrieve`），旧逻辑会把 lark-cli 返回的**权威 `missing_scopes` 信号**在 `normalizeCliErrorMessage` 里泛化成"检查不到工具"，导致：

- 用户看到误导性的"权限不足/查不到工具"，却不知道到底缺什么、怎么补
- 唯一出路是去"设置 → 连接器"整个重新授权，体验重、路径长
- 根因是"授权镜像与真实 scope 不同步"——系统丢弃了 lark-cli 的结构化错误

这正是用户最初报告的"点查看知识库→个人文档失败，之前能用"的根因。

## Target Users

- 在对话中读取/润色个人或团队飞书文档，但某类 scope 尚未授权的办公用户
- 不希望每次缺权限都跳设置页重新全量授权的高频使用者

## What Changes

- 在工具失败时解析 lark-cli 权威 `missing_scopes`（结构化字段优先，文本回退），精确识别"缺哪几个 scope"
- 在对话内渲染一张**即需即授**卡片：用友好能力名（如「知识库检索」）说明缺什么，可展开查看原始 scope
- 提供"一键补齐授权"按钮，只申请缺失的那几个 scope（增量授权，而非全量重授）
- 授权成功后**自动续跑**用户原始提问，无需重新发起

## Non-goals

- 不迁移到飞书官方 OAuth authorization code flow（仍复用 lark-cli device flow）
- 不实现授权"进度可视化"阶段时间线（后续增强）
- 不改变飞书写入的两阶段草稿确认流程

## Success

- 无权限读取个人飞书文档时，对话内出现友好能力名的失败卡片，而非跳设置的旧提示
- 卡片可展开看原始 scope；点按钮只增量申请缺失 scope
- 授权确认后自动续跑原始提问并读到正文
- 无权限时不编造正文；授权失败/取消可恢复
