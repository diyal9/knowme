# 验证证据索引

汇总结果与未验证边界见 [测试报告](../test-report.md)，独立缺陷复核见 [代码审查](../code-review.md)。不提交凭据、真实用户原文或生产会话快照。

可重复运行的证据：

- `tests/tool-execution-approval-checkpoint.test.js`：精确 checkpoint、连续批准恢复、冷进程及不确定写入。
- `tests/expert-task-operation-approval.test.js`：真实本地 registry → IPC → task store → expert runtime，副作用计数。
- `tests/agent-approval-recovery-context.test.js`：模型收到宿主成功回执，不能从模型陈述恢复成功。
- `tests/agent-capability-authorization-integration.test.js`：发现、授权、撤销及限制。
- `tests/skill-session-freshness.test.js` / `tests/skill-host-ipc.test.js`：实时权限及显式用户入口。
- `tests/agent-skill-checkpoint.test.js`：完整激活、版本更新、恢复与必要资源预算。
- `tests/agent-cold-mcp-rounds.test.js` / `tests/connector-cold-lazy-registry.test.js`：500 个冷连接器经模型发现入口激活、单连接器 500 项目录不截断、下一轮实际调用。
- `tests/mcp-tool-pagination.test.js`：stdio / HTTP / SSE 三种真实协议适配的分页、循环及错误边界。
- `tests/brain-query-scope.test.js` / `tests/agent-knowledge-request-guard.test.js`：原生知识隔离。
- `scripts/agent-capability-context-benchmark.js`：100/500 项合成目录的可发现性、schema token 及本地延迟。

真实连接器测试与人工截图尚未提供；不存在截图不能写成体验已人工验收。
