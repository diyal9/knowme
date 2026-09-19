# RQA-02：长材料修改轮不能静默遗漏要求

## 已复现

1. 专家任务把 SOP、材料、交付约束、修改意见拼成一个字符串，再保留前 12000 字。两份各 8000 字的合法材料足以截掉本轮意见。旧测试仍允许普通草稿登记成 v2。
2. 即便去掉任务层裁剪，统一 `fitConversation` 仍按单条消息 4000/6000 token 上限裁剪当前用户输入；因此只断言任务 payload 不足以验证模型收到完整要求。
3. 上一版 artifact 正文先裁为每份 6000 字，再把合并后的正文裁为 12000 字。新增长正文尾部标记回归在原实现失败。

## 修复

- `expert-task-runtime.buildPrompt` 不再固定按字符截断正式请求。
- 修改轮保留前一版 artifact 全文，仍附资源引用；没有额外读写用户成果。
- `llm-runtime.fitConversation` 为当前用户完整消息保留预算（工具续轮中最后一条不是用户消息时也成立），不再套用历史文本的单条上限。
- 工具参数、图片引用作为不可分割开销预留，其他历史/工具正文按剩余预算裁剪，保留调用与结果配对。
- 当前输入或必需记录装不下时抛出明确预算错误；不裁掉要求后继续生产下一版。任务错误路径保留原成果和修改意见。
- 矩阵夹具复制单个专家包到临时 capabilitiesRoot，测试快照不再写入源码 catalog。

## 证据

- 红测：两份长材料场景缺少用户修改意见；原统一 fitter 未保留完整长输入；超预算不抛错；工具续轮裁掉长输入。
- 红测：6500 字以上的前一版正文末尾 `PREVIOUS_END` 缺失。
- 绿测：短材料与两份 8000 字材料均保留意见、来源尾部、多个上一版成果；真实 `finalizeAgentContext` 组装后的消息包含完整 capturedPrompt。
- 绿测：4000 token 预算不能容纳修改请求时，模拟模型边界调用数为 0，任务 failed、deliverable 仍 v1、旧 artifact 和反馈原文保留，controller 释放。
- 定向回归：`node -r ./scripts/register-ts.js --test --test-reporter=dot tests/expert-task-runtime.test.js tests/llm-runtime.test.js tests/agent-context-finalize.test.js tests/agent-run-executor.test.js`，63 项通过，退出 0。
- 前一版全量 check：1974 后端通过，51 跳过；519 前端通过；lint/typecheck 通过。追加上一版正文修复后最新全量结果待记录。

## 风险与边界

GitNexus 对 buildPrompt/execute 返回 LOW，对共享 fitConversation 返回 HIGH；修改前已告知。索引全文搜索不可用，人工补查当前直接调用：agent-context-finalize 与模型工具循环。测试 harness 新符号未被索引，人工检查其两个矩阵调用点。

此记录不是模型专业质量或全部专家验收证明。测试中的模型/工具结果为隔离桩，实际上下文组装/预算和任务存储路径没有替换。超长输入当前明确失败，后续仍需完善材料分块检索和面向用户的恢复引导；不得把失败关闭等同于大材料专业任务已可用。
