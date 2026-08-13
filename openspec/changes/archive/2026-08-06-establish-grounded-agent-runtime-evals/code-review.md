# Code Review: establish-grounded-agent-runtime-evals

- 日期：2026-08-06
- 审查人：正式测试（QA focused re-test · 代码证据审查）
- 范围：A1/A2 修复 + tasks 7.5/8.3 等价 E2E

## 总结

| 维度 | 判定 | 说明 |
|---|---|---|
| A1 violation 友好化 | **通过** | `formatViolationForUser` + GroundingUI 统一渲染 |
| A2 details 状态保持 | **通过** | capture/restore + patchAssistantGroundingMeta |
| Fail-closed / OutputGate | **通过** | 无变更回归；1011 test 绿 |
| postProcess 与 OutputGate 双轨 | **通过** | postProcess 仍在 GROUND 前；gate 覆盖编造 |
| 数据隐私 | **通过** | probe 仅哈希+bodyLen；正文不落盘 |
| legacy 回滚 | **ADVISORY** | `KNOWME_GROUNDING_RUNTIME=legacy` 跳过 VERIFY（设计如此） |
| fail-open 路径 | **无发现** | streaming 期间不渲染 verified badge |

## A1 修复审查

### `src/lib/agent-grounding-labels.js`

- 新增 `formatViolationForUser`：按 violation.code 映射友好中文；`missing_required_tools` 用 `formatToolLabelsForUser`。
- `stripRawToolIdsFromText` + fallback 兜底未知 message。
- 机器字段 `violations[].message` 仍保留在 IPC/ledger（供调试），UI 层不直出。

### `src/lib/agent-grounding-runtime.js`

- `buildGroundingStatus` 为每条 violation 附加 `userMessage: formatViolationForUser(v)` — 双轨：机器 + 用户字段。

### `src/lib/agent-grounding-ui.js`

- `renderGroundingStatusMetaHtml` 调用 `formatViolationForUser(violations[0])`，非 raw message。
- 来源列表用 `formatToolLabelForUser(s.tool)` — verified 路径友好。

### `src/workspace-agent.js`

- `renderGroundingStatusMeta` 委托 `GroundingUI.renderGroundingStatusMetaHtml` — 消除重复实现。

**QA 验证**：fixture `blocked-no-raw-tool-in-bubble: true`；单测 `renderGroundingStatusMetaHtml never emits raw tool ids`。

## A2 修复审查

### `src/lib/agent-grounding-ui.js`

- `captureGroundingDetailsOpenState` / `restoreGroundingDetailsOpenState` — 按 bubble data-idx 索引 open 状态。
- `patchAssistantGroundingMeta` — 替换 meta 前记录 wasOpen，替换后恢复。

### `src/workspace-agent.js`

- `renderChat()` L2646–2703：重建 HTML 前 capture、后 restore — 修复全量刷新丢状态。
- `grounding-status` 事件 L4323–4332：非 streaming 且有 text 时走 `patchAssistantGroundingMeta`（增量），否则 `refreshAssistantProgress` — 避免 done 前不必要的全量 renderChat。
- L2695：streaming 期间 `groundingMeta = ''` — **无提前 verified 徽章**。

**QA 验证**：`details-open-survives-rerender: true`；单测 2/2 PASS。

## tasks 7.5/8.3 等价 E2E

### `evidence/grounding-meeting-e2e.js`

编排四层：executor eval、feishu readonly probe、ui fixture smoke、electron boot — 17 checks 聚合。

### `scripts/feishu-readonly-meeting-probe.js`

- production `executeMeetingCandidates` + `executeMeetingRead`
- `writeBlocked: true`；tokens 仅 SHA256 前缀哈希

**QA 独立复跑**：17/17 PASS；probe ok；read bodyLen=8635。

## 风险扫描

| 风险 | 结论 |
|---|---|
| fail-open（gate 绕过） | 未发现；OutputGate 仍在 persist 前 |
| 隐私泄漏（probe/截图） | 正文未落盘；audit 仅 digest/hash |
| legacy 与 runtime 不一致 | legacy 跳过 VERIFY 为 feature flag 设计；默认 runtime |
| UI 内部 id 泄露 | 用户可见层已清零；IPC violations 仍含 machine message（不渲染） |
| ReadLints | 改动文件无 error |

## 遗留 ADVISORY（不阻塞）

1. **A3**：harness gate 未硬读 eval 阈值 — npm test 已覆盖 conversation suite。
2. **A4**：autoMatch L0 不注入 groundingContract — slash 主路径已测。
3. **A5**：未做在线 LLM 真实流式 spot-check — 等价 E2E 可接受。

## 审查结论

- **无 BLOCKING**
- **A1/A2 修复有效，上轮 ADVISORY 清零**
- **正式 QA 可放行 `/gate-check`**
