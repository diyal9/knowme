# 制作人体验验收报告

- **Change**：`agent-kernel-executor-eval-baseline`
- **验收人**：制作人
- **日期**：2026-08-04
- **Preflight**：`node .cursor/scripts/harness.js preflight --json` → ok
- **结论**：**PASS**（放行测试 QA）

## 核对开发证据

| 项 | 结果 |
|---|---|
| `evidence/dev-self-test.md` | 存在；967 tests / lint / strict validate PASS |
| `evidence/eval-report.json` | 7/7 fixture PASS，零网络 |
| 本 change 引入 uncaught error | 桌面冒烟与 Playwright Electron 会话均未观测到（仅 Electron CSP 安全警告，可忽略） |

## 桌面冒烟（tasks 6.4 / qa-plan S1–S4 / S6）

执行脚本：`evidence/producer-desktop-smoke.js`  
结构化报告：`evidence/producer-desktop-smoke.json`  
截图：`evidence/screenshots/`（kernel S1–S3、legacy S6、no-api-key 尝试）

环境说明：
- 使用隔离 temp `user-data-dir` + 复制本机 `settings.json`（含加密 API Key）进行 **真实在线 LLM** 验证
- 默认 executor：`kernel`；回滚：`KNOWME_AGENT_EXECUTOR=legacy`

| 编号 | 场景 | 桌面结果 | 备注 |
|---|---|---|---|
| S1 | 普通 chat「你好」 | **PASS** | 有回复；时间线「执行过程 N 步」正常；无 runPhase 枚举泄露 |
| S2 | 知识检索意图 | **PASS** | 时间线 3 步；命中知识库条目（RDPI 团队约定等） |
| S3 | 取消生成 | **部分 PASS** | 长生成在 2.5s 内已完成，未能点到「停止」；取消后继续发送「收到」成功。**Eval 替代**：`cancel-mid-model` fixture → CANCELLED |
| S4 | Kernel 模式 S1–S3 | **PASS** | 与 legacy 行为一致（见 S6） |
| S6 | Legacy 回滚 | **PASS** | `KNOWME_AGENT_EXECUTOR=legacy` 启动并完成 S1 基础 chat |

## acceptance.md 核心路径

| 路径 | 结果 | 证据 |
|---|---|---|
| 办公助手普通 chat + 时间线 | PASS | S1 桌面 + `chat-simple` eval |
| retrieval/工具类问题 | PASS | S2 桌面 + `knowledge-tool` eval |
| 长生成停止 | 部分（Eval 补全） | S3 桌面 follow-up OK；`cancel-mid-model` eval |
| 未配置 API Key 引导 | Eval 替代 | 隔离 userData 桌面未能稳定复现（进程/单实例干扰）；**`error-no-api-key` eval PASS**，终端态 PREPARE→ERROR |

## 体验标准核对

- 无新增弹窗或打扰：**是**
- 时间线文案/图标与现有助手一致：**是**
- 停止后可继续 composer：**是**（S3 follow-up 验证）
- 用户不可感知内核/eval：**是**（runPhase 未出现在 UI）

## 未覆盖边界（移交测试 QA）

1. **S3 真机取消时序**：需在生成足够长时手动点「停止」，验证 tool/LLM 中断（反模式 A3）
2. **无 API Key 桌面路径**：建议在干净 user-data-dir 手工清空 Key 后走查错误气泡文案
3. **Session 持久化回归**（qa-plan Regression）：Run 结束后重启，对话历史仍在
4. **响应时间主观对比**（反模式 A6）：kernel vs legacy 同输入延迟
5. **并行 change 隔离**：测试阶段确认未回归 icon/workbench/capability-pack 范围

## 测试接入建议

- 按 `qa-plan.md` 执行正式 QA，优先补 S3 取消与 Session 持久化
- 反模式清单 A1–A6 全部执行
- 产出 `evidence/test-report.md` 后再 `/gate-check`
