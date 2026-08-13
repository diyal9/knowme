# 测试报告: stabilize-agent-stream-completion

- 日期：2026-08-06
- 角色：测试（Tester）
- 接入前提：开发自测 PASS + 制作人验收 PASS（`acceptance.md`）
- 总判定：**PASS**（含 ADVISORY 局限，无 BLOCKING）

## 门禁

| 级别 | 检查项 | 结果 |
|------|--------|------|
| 硬 | npm test | **PASS**（1193/1193） |
| 硬 | npm run lint | **PASS** |
| 硬 | harness gate | **PASS** |
| 软 | qa-plan Smoke Scope | **已执行**（契约 + fixture；见局限） |
| 软 | code-review.md | **未完成**（ADVISORY） |
| 软 | OpenSpec strict validate | **PASS** |

## Smoke 结果

| 用例 | 结果 | 方法 | 备注 |
|------|------|------|------|
| 普通多 chunk 回答：不闪屏、不重播 | **PASS*** | 契约 + 源码 | `gotNonEmptyStream` + `completeAssistantBubble`；*未在线 LLM 手测 |
| 工具调用：运行中展开、完成后折叠 | **PASS** | HTML fixture | `执行进度` open → `执行过程` 无 open |
| 单次完整 flush：只显示一次 | **PASS** | 契约 | 禁止 `streamUpdateCount <= 1` 重播路径 |
| 待确认写入：审批入口可见 | **PASS** | HTML fixture | pending 时 `details[open]` + 批准/拒绝 |
| 用户手动重展开执行过程 | **PASS** | `<details>` 语义 + 源码 | `removeAttribute('open')` 仅完成时执行一次 |
| 长 Markdown 收尾与滚动稳定 | **PASS*** | 静态契约 | `isStreamTail` / `reconcileCompletedAssistantBody` / `isChatNearBottom`；*未 Electron 截图 |
| 生成中停止：无 IPC 克隆错误 | **PASS** | 开发真机 JSON | `cancel-ipc-smoke.json` ok=true, cloneError=false |
| 无 raw CoT | **PASS** | 集成测试 + 源码 | Renderer 无 `reasoning_content` |

## 自动化明细

| 命令 | 结果 |
|------|------|
| `node --test tests/agent-stream-repaint.test.js tests/agent-streaming-integration.test.js` | 23/23 PASS |
| `node --test tests/agent-run-executor.test.js` | 3/3 PASS（含 `structuredClone` 取消结果） |
| `node evidence/tester-stream-completion-smoke.js` | 7/7 smoke + 6/6 反模式 PASS |
| `npx openspec validate stabilize-agent-stream-completion --strict` | PASS |

## 反模式发现

本轮反模式清单 **6/6 静态 PASS**，未发现 BLOCKING 缺陷。

| 反模式 | 结果 | 验证方式 |
|--------|------|----------|
| 回答完整出现后消失并重打字 | PASS | 源码无 `streamUpdateCount <= 1`；完成走 `completeAssistantBubble` |
| 折叠时连带替换/移动最终回答 | PASS | `reconcileCompletedAssistantBody` 保留 `data-assistant-body` |
| 阶段更新重播动画或关闭用户展开详情 | PASS | `patchExecutionTimeline` 不强制 `setAttribute('open')` |
| 待确认步骤自动折叠隐藏审批 | PASS | `hasPendingReview` → `setAttribute('open')` |
| 取消透传内核对象致克隆失败 | PASS | main.js 显式投影 + executor 无 `ports` |
| 展示模型原始 CoT | PASS | Renderer 无 `reasoning_content` |

### ADVISORY 项（不阻塞 story-done）

1. **在线 LLM 未测**：当前无 API Key，`multi-chunk-no-flash-replay` 与长 Markdown 滚动跳跃仅契约等价验证；建议有 Key 环境 spot-check。
2. **Electron 并行 smoke 跳过**：`npm start` 占用单实例锁，未复跑 `cancel-ipc-smoke.js` Playwright；沿用开发 `cancel-ipc-smoke.json`。
3. **无截图证据**：本轮未新增 `evidence/screenshots/`（制作人/开发 cancel 截图路径未在仓库中）；真机视觉回归待下次无并发实例时补拍。
4. **code-review.md 缺失**：软项 ADVISORY，不影响本 change 功能门禁。

## 环境局限

- 工作目录：`D:\aispace\knowme`（git 根 `D:\aispace\sticky-notes`）
- Electron：`npm start` 单实例运行中，测试未启动第二实例
- API Key：不可用，未执行真实流式/工具链 E2E

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

硬门禁全 PASS；Smoke Scope 与反模式清单在契约/fixture 范围内全部 PASS。ADVISORY 项已记录，建议归档后于有 Key + 无并发实例环境补 spot-check。

## 证据路径

| 文件 | 说明 |
|------|------|
| `evidence/test-report.md` | 本报告 |
| `evidence/tester-stream-completion-smoke.json` | Tester smoke 机器可读结果 |
| `evidence/tester-stream-completion-smoke.js` | Tester smoke 脚本 |
| `evidence/producer-stream-completion-smoke.json` | 制作人 smoke（8/8） |
| `evidence/cancel-ipc-smoke.json` | 取消态真机（开发） |
| `evidence/dev-self-test.md` | 开发自测 1193/1193 |
| `evidence/producer-acceptance.md` | 制作人验收 PASS |
| `acceptance.md` | 制作人放行 |
