# QA Plan: agent-kernel-executor-eval-baseline

## Smoke Scope（必填）

- [x] **S1 普通 chat**：办公助手发送「你好」，无 API 配置错误；期望正常回复、时间线显示准备/生成阶段、无报错（制作人桌面 PASS）
- [x] **S2 知识检索**：发送「查一下知识库里关于 XX 的约定」（或等效 retrieval 意图）；期望出现检索/工具相关阶段，不崩溃（制作人桌面 PASS）
- [x] **S3 取消生成**：生成过程中点击停止；期望终态 cancelled、无残留 loading、可继续下一轮对话（制作人：follow-up PASS；取消时序 Eval 补全）
- [x] **S4 Kernel 模式**：默认或 `KNOWME_AGENT_EXECUTOR=kernel` 下 S1–S3 行为与 legacy 一致（制作人桌面 PASS）
- [x] **S5 Eval 离线绿**：无 API Key 环境运行 `npm test`，agent-eval 用例全部 PASS（开发：967 tests PASS，7/7 fixture）
- [x] **S6 回滚**：`KNOWME_AGENT_EXECUTOR=legacy` 重启后 S1 仍可用（制作人桌面 PASS）

## Regression Scope

- `npm test` 全量（含既有 `agent-streaming-integration`、`agent-recovery`、`agent-verify`）
- `npm run lint`
- Session 持久化：Run 结束后重启应用，对话历史仍在
- 工具时间线标题映射未回归（如「读取网页」「知识检索」等）
- 并行 change 不受影响：未修改 `extract-game-studio-capability-pack`、`restore-unified-knowme-brand-icon`、`unify-capability-fabric-foundation` 范围

## Anti-pattern Checks（交给测试）

| # | 反模式 | 检查点 |
|---|---|---|
| A1 | 双路径行为分叉 | legacy 与 kernel 同输入下终态/错误文案不应矛盾 |
| A2 | 阶段丢失 | 时间线不应出现「长时间无阶段更新后突然结束」 |
| A3 | 取消无效 | 停止后仍继续 tool/LLM 调用 |
| A4 | Eval 依赖外网 | CI/无 Key 环境 test 不应 skip 整个 agent eval |
| A5 | 用户可见 runPhase | UI 不应展示内部阶段枚举 |
| A6 | 大爆炸回归 | 普通 chat 响应时间不应明显劣化（主观 <2x） |

## 安全用例

| # | 场景 | 期望 |
|---|---|---|
| SEC1 | executor 内无直接 `fetch` 硬编码 | 网络仅经注入 llm port |
| SEC2 | mock eval fixture 不含真实 API Key | fixture 审查 |

## 证据路径

- 开发自测：`evidence/dev-self-test.md`
- Eval 报告：`evidence/eval-report.json`（若实现 5.1）
- 测试报告：`evidence/test-report.md`（测试阶段）
