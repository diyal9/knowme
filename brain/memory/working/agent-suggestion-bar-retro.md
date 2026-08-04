# Retro: agent-suggestion-bar

日期：2026-07-22

## 做了什么

- 聊天建议/操作条：`suggestion` fence + 白名单动作
- 与 A2UI/工作流 surface 分离；底座提示引导模型可选输出

## 学到什么

- 聊天「可点」要用结构化块，不要 Markdown 表冒充
- 解析放独立 lib 便于单测与浏览器共用（UMD）

## 可升格

- 聊天轻交互 vs 工作流 surface 分层 — 已写入 proposal，复发再 evolve
