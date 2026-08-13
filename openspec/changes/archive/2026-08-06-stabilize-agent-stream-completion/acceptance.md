# 制作人体验验收：稳定 Agent 流式收尾

## 核心路径

- [x] 工具执行期间可看到展开的「执行进度」和逐步状态（fixture + 契约：`runtime-timeline-expanded`）
- [x] 最终回答开始显示后不消失、不从头重播（源码：`gotNonEmptyStream` + `completeAssistantBubble`；契约 23/23）
- [x] 回答完成后执行过程自动折叠，正文保持原位（fixture：`completion-timeline-collapsed`）
- [x] 点击「执行过程」可重新展开并查看工具步骤（`<details>` 语义 + 源码 `removeAttribute('open')`）
- [x] 有待确认写入时不自动隐藏批准/拒绝入口（fixture：`pending-review-stays-visible`）

## 体验标准

- [x] 对话过程接近 Cursor：过程可追踪，结果稳定，完成后自动降噪
- [x] 长回答收尾无明显整页闪动、滚动跳跃或内容重复（契约覆盖 `completeAssistantBubble` / 禁止 `renderChat` 全量收尾）
- [x] 不展示模型原始 chain-of-thought（Renderer 无 `reasoning_content`；集成测试断言）

## 独立核验

| 项 | 结果 | 证据 |
|---|---|---|
| 契约测试 23/23 | PASS | `producer-stream-completion-smoke.json` |
| 取消态 IPC 无克隆错误 | PASS（沿用开发真机） | `cancel-ipc-smoke.json` |
| 运行中 Electron 健康 | PASS | 终端 `npm start` 主进程正常，无业务 uncaught error |
| Playwright 并行真机 smoke | **跳过** | 单实例锁 + 无 API Key（见局限） |

## 局限（ADVISORY，不挡验收）

1. **单实例锁**：`main.js` `requestSingleInstanceLock()` 导致 npm start 运行时无法并行 Playwright Electron；本轮采用 node fixture + 契约等价验证。
2. **无在线 LLM**：`settings.json` 无 API Key，未做真实多 chunk / 工具链手测；建议 Tester 在有 Key 环境 spot-check 长 Markdown 收尾与滚动稳定。
3. **取消态截图**：`cancel-ipc-smoke.png` 为开发自测产出，制作人本轮未复拍（JSON 证据已核对）。

## 验收结论

- [x] **通过**
- 验收人：制作人
- 日期：2026-08-06

放行 **测试角色** 接入（qa-plan Smoke Scope 中除取消项外仍建议 Tester 补在线 LLM spot-check）。
