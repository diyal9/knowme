# Knowledge Bundle Update Log

## 2026-08-17

* **Promotion**: [Attached Plan Execution](processes/attached-plan-execution.md) — sticky `pat_bceaacf5`（附带 plan 落地）。
* **Update**: [Dev Collaboration Verbal Cues](processes/dev-collaboration-verbal-cues.md) — 增补「按照建议优化」（`pat_6f6f2eb0`）与附带 plan 交叉引用。
* **Update**: [MCP UI Deep Verify And Code Explore](processes/mcp-ui-and-code-explore-playbook.md) — 增补 `browser_console_messages` / `browser_resize` / `browser_tabs`（`pat_a3aaf630` `pat_7587b81f` `pat_bd7f07ea`）。
* **Update**: Skill `team-learned-dev-playwright-ui-verify` — 标准链纳入控制台/视口/多标签。

## 2026-08-16

* **Promotion**: [Electron Dev Restart And HMR](processes/electron-dev-restart.md) — 升格 sticky pattern「重启」（`pat_8530a8e8`）：日常再跑 `npm start` 即重启，不为看 UI 先 `renderer:build`。

## 2026-08-12

* **Promotion**: [MCP UI Deep Verify And Code Explore](processes/mcp-ui-and-code-explore-playbook.md) — sticky patterns：`browser_run_code_unsafe` / `browser_press_key` / `browser_network_requests` / `list_repos`（`pat_d3afb407` `pat_6b67301f` `pat_4d3fefc0` `pat_e8d31dc4`）。
* **Update**: [Dev Collaboration Verbal Cues](processes/dev-collaboration-verbal-cues.md) — 增补「执行」（`pat_8c8aff4b`，摘要乱码「鎵ц」）。
* **Promotion**: [Dev Collaboration Verbal Cues](processes/dev-collaboration-verbal-cues.md) — 升格 sticky patterns：可以 / 继续 / 同意 / 重启服务 / 评估并且优化方案（`pat_fd901191` `pat_fa0f859d` `pat_9a4df22d` `pat_472fdce2` `pat_34476184`）。

## 2026-08-07

* **Creation**: [Production Agent Team Runtime](concepts/production-agent-team-runtime.md) — 升格真实父子 Run、持久化 Runtime、跨 Builder Package、权限治理、幂等恢复与可审计执行原则。

## 2026-07-30

* **Creation**: [LLM Runtime And Cursor Benchmark](concepts/llm-processing-and-cursor-benchmark.md) — 记录 LLM 处理链路、工具闭环、记忆注入策略与 Cursor 能力对齐结论。

## 2026-07-16

* **Promotion**: [Team Skills](processes/team-skills.md) — 升格 `team-learned-dev-electron-runloop`、`team-learned-dev-playwright-ui-verify`（源自 memory patterns：打包/执行/重启、Playwright navigate+screenshot）。
* **Case**: `team/evolution/cases/dev-runloop-playwright-baseline.md`

## 2026-07-01

* **Creation**: [Adopt sticky-agent-memory](decisions/adopt-sticky-agent-memory.md) — Hook 本地 episodic 记忆层。
* **Creation**: [Adopt LLM Wiki + OKF](decisions/adopt-llm-wiki-okf.md)、[Evolution Loop](processes/evolution-loop.md)。
* **Creation**: 产品概念 [Product Overview](concepts/product-overview.md)、[Electron IPC](concepts/electron-ipc.md)。
