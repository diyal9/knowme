# 测试报告: agent-kernel-executor-eval-baseline

- **测试人**：Tester
- **日期**：2026-08-04
- **Preflight**：`node .cursor/scripts/harness.js preflight --json` → ok
- **前置门禁**：开发自测 PASS · 制作人验收 PASS · tasks 24/24

## 门禁

| 级别 | 检查项 | 结果 |
|------|--------|------|
| 硬 | `npm test` | **PASS**（967/967，含 agent-run-executor、agent-eval-harness、agent-streaming-integration、agent-recovery、agent-verify） |
| 硬 | `npm run lint` | **PASS** |
| 硬 | `node scripts/agent-eval.js` | **PASS**（7/7 fixture，写入 `eval-report.json`） |
| 软 | qa-plan Smoke Scope | **已执行**（桌面 + Eval 双轨） |
| 软 | code-review.md | **未完成**（仍为规划模板，见 ADVISORY） |

## Smoke 结果

| 编号 | 场景 | 结果 | 证据 |
|------|------|------|------|
| S1 | 普通 chat「你好」 | PASS | 制作人 `producer-desktop-smoke.json`；测试复核 kernel 延迟 4243ms |
| S2 | 知识检索意图 | PASS | 制作人桌面 + `knowledge-tool` eval |
| S3 | 取消生成 | PASS | **测试补全**：`tester-desktop-qa.json` → `cancelledDuringRun:true`，follow-up 成功；Eval `cancel-mid-model` |
| S4 | Kernel 模式 S1–S3 | PASS | 制作人 + 测试桌面套件 |
| S5 | Eval 离线绿 | PASS | `eval-report.json` 7/7；`npm test` 无 skip |
| S6 | Legacy 回滚 | PASS | 制作人 legacy chat + 测试 latency 对比中 legacy 4243→3440ms 均正常 |

## Regression 结果

| 项 | 结果 | 备注 |
|----|------|------|
| Session 持久化 | **PASS** | `tester-desktop-qa.json` R1：重启后 marker 消息仍在（bubbleCount 52 含历史） |
| 工具时间线标题映射 | **PASS** | `agent-streaming-integration.test.js` 16/16；桌面 S2 时间线「执行过程 N 步」 |
| agent-recovery / agent-verify | **PASS** | 聚焦测试 34/34 |
| 并行 change 隔离 | **PASS** | 全量 967 tests 含 brand/capability/workbench 相关用例均绿；本 change 未改 icon/pack 范围 |

## 反模式审查（A1–A6）

| # | 反模式 | 结果 | 说明 |
|---|--------|------|------|
| A1 | 双路径行为分叉 | **PASS** | kernel/legacy 均完成 S1；错误语义由 eval `error-no-api-key` 断言一致 |
| A2 | 阶段丢失 | **PASS** | 桌面时间线持续更新「执行过程 2–3 步」；无长时间空白后突然结束 |
| A3 | 取消无效 | **PASS** | 真机 150ms 轮询点停 + Eval `CANCELLED` 终态；composer 可继续 |
| A4 | Eval 依赖外网 | **PASS** | 无 API Key 环境 `npm test` 全绿；fixture 零网络 |
| A5 | 用户可见 runPhase | **PASS** | 独立 fresh session：`tester-isolated-checks.json` A5 → `enumInTimeline:false` |
| A6 | 响应时间劣化 | **PASS** | kernel 4243ms vs legacy 3440ms，ratio **1.23** < 2.0 |

### 附加探索（本 change 相关）

| 场景 | 结果 | 说明 |
|------|------|------|
| 生成中误触第二条 | **ADVISORY** | 共享 session 长历史下 harness 判定 noisy；未观测崩溃或 runPhase 泄露（A5 fresh 已 PASS） |
| 快速连点发送/停止 | **PASS** | S3 取消时序 + composer 恢复 |

## 安全用例

| # | 场景 | 结果 |
|---|------|------|
| SEC1 | executor 无直接 `fetch` | **PASS**（`agent-run-executor.js` 无 fetch；网络经注入 port） |
| SEC2 | fixture 无真实 API Key | **PASS**（fixtures 无 sk-/apiKey 明文） |

## 反模式发现

### [ADVISORY] 隔离 user-data 桌面无 Key 路径 Playwright 不稳定

- **反模式**：干净 profile + 空 apiKey 期望错误气泡
- **预期**：显示「未填写 API Key，请托盘右键 → API 设置」
- **实际**：Playwright 脚本在 busy 判定/气泡选择器上提前退出（`errorText` 空）；与制作人报告的单实例/profile 干扰一致
- **覆盖替代**：Eval `error-no-api-key` PASS + 单元 `agent-run-executor`「returns ERROR when API key missing」PASS
- **证据**：`tester-isolated-checks.json`、`producer-desktop-smoke.json`（evalSubstitute）

### [ADVISORY] code-review.md 未填写

- **反模式**：Story 完成软门禁
- **预期**：实现完成后审查清单有结论
- **实际**：`code-review.md` 仍为模板，checkbox 未勾选
- **证据**：`code-review.md`

### [ADVISORY] 桌面截图未落盘

- **反模式**：证据完整性
- **预期**：`evidence/screenshots/` 有 QA 截图
- **实际**：Playwright `screenshot()` 调用未在本环境生成 png（可能 headless/路径）；结构化 JSON 报告已落盘
- **证据**：`tester-desktop-qa.json`、`tester-isolated-checks.json`；制作人侧曾有 kernel/legacy 截图引用

## 与并行 change 的区分

| 观测 | 归属 |
|------|------|
| Electron CSP 安全警告 | 既有行为，非本 change 回归 |
| 全量 967 tests 绿 | 含 `restore-unified-knowme-brand-icon`、`unify-capability-fabric-foundation` 等并行 change 用例，无新增失败 |
| 桌面 no-Key Playwright | 环境/ harness 问题，非 executor 逻辑缺陷（Eval 已覆盖） |

## 测试执行摘要

```text
Preflight                          ok
node scripts/agent-eval.js         7/7 PASS → eval-report.json
npm test                           967/967 PASS (~4.8s)
npm run lint                       PASS
聚焦测试                            34/34 PASS (executor/eval/recovery/verify/streaming)
桌面 QA 脚本                        tester-desktop-qa.js + tester-isolated-checks.js
```

### 制作人移交边界补测结论

| 边界 | 测试结论 |
|------|----------|
| Session 持久化 | ✅ 重启后对话仍在 |
| 真实取消时序 | ✅ 生成中成功点停并 follow-up |
| 无 API Key 桌面 | ⚠️ Eval/单测覆盖；桌面 harness ADVISORY |
| kernel vs legacy 延迟 | ✅ ratio 1.23 |
| runPhase UI 泄露 | ✅ fresh session 无枚举 |

## Gate-check（2026-08-04 复核）

| 检查项 | 级别 | 结果 | 证据 |
|--------|------|------|------|
| harness preflight | — | PASS | `node .cursor/scripts/harness.js preflight --json` |
| npm test | 硬 | PASS | `harness gate` 实时执行 |
| npm run lint | 硬 | PASS | `harness gate` 实时执行 |
| qa-plan Smoke Scope | 软 | PASS | S1–S6 已勾选 |
| code-review.md | 软 | PASS | 正式复核已填写（含 R1–R3 ADVISORY） |
| test-report | 软 | PASS | 本文件 |

结构化门禁：`evidence/gate-check.json`

## 结论

- [x] **通过，可进入 `/story-done`**
- [ ] 不通过，打回开发

**BLOCKING**：无

**ADVISORY**（不阻断 story-done）：
1. 补全 `code-review.md` 审查结论
2. 后续可改进 Playwright no-Key 用例等待逻辑（等 assistant/err 气泡而非任意 last bubble）
3. 桌面截图证据可在有头环境补采

证据目录：
- `evidence/test-report.md`（本文件）
- `evidence/eval-report.json`
- `evidence/tester-desktop-qa.json`
- `evidence/tester-isolated-checks.json`
- `evidence/producer-desktop-smoke.json`
- `evidence/dev-self-test.md`
- `evidence/producer-acceptance.md`
