---
type: Concept
title: LLM Runtime And Cursor Benchmark
description: KnowMe LLM processing architecture and capability benchmark against Cursor-style L3 workflow.
tags: [llm, agent, context, tools, memory, benchmark]
timestamp: 2026-07-30T00:00:00Z
resource: knowme://llm/runtime-benchmark
---

# Scope

沉淀 KnowMe 在 LLM 处理、上下文编排、工具执行、记忆门控、可观测性方面的长期知识，并给出对 Cursor 参考能力的对齐结论。

# Runtime pipeline

- 模型路由与请求策略：按 tier、模型能力和温度策略生成输入/输出预算。
- 动态上下文编排：角色方式、时间锚点、本轮理解、Session 摘要、检索上下文、记忆上下文。
- 分段预算裁剪：按优先级 + maxTokens 对上下文段落进行保留与截断。
- 对话轮次裁剪：按完整轮次保留最新语义，避免拆散 assistant/tool 关联。
- 工具执行循环：模型决定工具调用，执行后回填结果，受轮次/调用上限与重复调用检测约束。
- 收敛与降级：预算耗尽或重复调用时进入最终答复收敛，避免死循环。
- 观测输出：记录 contextInfo（sectionUsage、sectionOmitted、memoryPolicy、omittedTurns 等）。

# Memory policy

- `disabled_by_setting`：显式关闭记忆注入（环境变量或设置项）。
- `empty_memory`：记忆为空，不注入。
- `chat_tier`：聊天层默认不注入长期记忆。
- `enabled`：在检索/助理等 tier 且有记忆内容时注入。

# Cursor benchmark

- 已对齐：多会话上下文装配与会话历史隔离。
- 已对齐：分层动态上下文与优先级预算压缩。
- 已对齐：工具调用闭环（计划/执行/观察/继续）。
- 已对齐：记忆注入可控策略与显式原因。
- 已对齐：可观测调试信息暴露到运行态。
- 部分对齐：跨设备云端记忆与账号级全局编排（本项目当前聚焦本地桌面与工作区范围）。

# Code anchors

- `src/lib/agent-context-orchestrator.js`
- `src/lib/llm-runtime.js`
- `src/lib/agent-loop.js`
- `src/main.js`
- `tests/agent-context-orchestrator.test.js`

# Related

- Wiki 说明：`../../wiki/concepts/llm-processing-and-cursor-benchmark.md`
- 产品总览：[/concepts/product-overview.md](/concepts/product-overview.md)
- IPC 概念：[/concepts/electron-ipc.md](/concepts/electron-ipc.md)
