---
okf_version: "0.1"
---

# KnowMe Knowledge Bundle

OKF v0.1 长期知识库。概念 ID = 文件路径去掉 `.md` 后缀。

可 `npm run kb:export` 打包分享给其他用户；`npm run kb:import` 导入外部 bundle。

## Concepts

* [Product Overview](concepts/product-overview.md) - 产品定位与边界
* [Electron IPC](concepts/electron-ipc.md) - IPC 与安全约定
* [LLM Runtime And Cursor Benchmark](concepts/llm-processing-and-cursor-benchmark.md) - LLM 处理链路、能力对标与差距边界
* [Production Agent Team Runtime](concepts/production-agent-team-runtime.md) - 真实子 Run、持久化编排、跨 Builder 治理与恢复

## Decisions

* [Adopt LLM Wiki + OKF](decisions/adopt-llm-wiki-okf.md) - 知识库双层架构
* [Adopt sticky-agent-memory](decisions/adopt-sticky-agent-memory.md) - Hook 本地会话记忆决策

## Processes

* [Evolution Loop](processes/evolution-loop.md) - 自我进化循环
* [Team Skills Registry](processes/team-skills.md) - 团队 Skill 登记
* [Dev Collaboration Verbal Cues](processes/dev-collaboration-verbal-cues.md) - 口头确认与重启/评估优化口径
* [MCP UI Deep Verify And Code Explore](processes/mcp-ui-and-code-explore-playbook.md) - Playwright 深验与 GitNexus list_repos

## References

* [Karpathy LLM Wiki](references/karpathy-llm-wiki.md) - 维基模式引用
* [OKF Specification](references/okf-spec.md) - OKF v0.1 规范
