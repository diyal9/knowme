# Code Review: office-partner-grounded-connectors

- 日期：2026-08-03
- 审阅范围：飞书工具门控与 grounding、GitHub/网页内容源、工作台/设置 UI、润色改写链路、飞书 API 瞬时故障友好化

## 检查项

| 项 | 结论 | 说明 |
|----|------|------|
| 飞书状态拆分 | PASS | 未启用 / 未授权 / allowlist 缺口 / 未读正文四类提示可区分，不再笼统「检查不到工具」 |
| 工具投影一致性 | PASS | `projectedToolNames` 共享规则；连接器状态含 `projectedAllowlist` |
| GitHub 内容源 | PASS | 复用 GitLab clone 缓存模式，`sources.addGithub` + 只读 file tools |
| 网页内容源 | PASS | `web-source.fetchPageSnapshot` 抽取正文并本地缓存，路径安全与 active source 对齐 |
| UI 与文案 | PASS | 设置页与工作台支持 github/web 添加、同步、浏览；与既有 local/gitlab 风格一致 |
| 润色改写链路 | PASS | `polish_rewrite` 任务默认 retrieval；注入 active source 提示；强调事实边界 |
| 飞书写入安全 | PASS | 仍走两阶段草稿审阅，未绕过确认 |
| 瞬时故障友好化 | PASS | `runLarkCliWithRetry` + `buildToolFailureHint` 兜底，不向用户暴露原始 JSON/log_id |
| 向后兼容 | PASS | 本地目录、GitLab、RAG/MCP 投影与既有飞书 read/search 链路未回退 |
| 测试覆盖 | PASS | `feishu-grounding` / `connectors` / `sources` / `writing-workflow` / `feishu-cli` / `agent-tool-failure-hint` 有定向单测 |
| 硬门禁 | PASS | `npm test` 739 pass；`npm run lint` ok（2026-08-03） |

## 潜在改进（非阻塞）

- 设置页 GitHub/网页源的手动端到端冒烟依赖本地 `npm start`，见 `dev-self-test.md` 备注
- 飞书「即需即授」增量授权已拆至独立 change `feishu-just-in-time-auth` 并归档，本 change 与之边界清晰

## 结论

✅ **PASS**。变更聚焦 proposal/design 范围，门控提示、内容源扩展与润色接地链路实现一致，可进入 `/story-done`。
