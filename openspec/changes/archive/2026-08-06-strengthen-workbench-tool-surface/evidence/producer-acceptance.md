# 制作人体验验收报告 — strengthen-workbench-tool-surface

- **验收人**：制作人 Agent
- **日期**：2026-08-06
- **结论**：**PASS**（核心 fake/单测/Electron 子集无 BLOCKING；见未执行项）

## 执行场景与证据

| 场景 | 方式 | 结果 | 证据 |
|---|---|---|---|
| Preflight | `node .cursor/scripts/harness.js preflight --json` | PASS | 会话日志 |
| Harness gate | `node .cursor/scripts/harness.js gate --json` | PASS（test+lint） | 会话日志 |
| 闭环 eval | `tests/tool-surface-closed-loop.test.js` + `evidence/tool-surface-eval.json` | 100% hard gates | `evidence/tool-surface-eval.json` |
| 文件写 draft/拒绝/traversal | 制作人 node 脚本 + `tests/agent-file-tools.test.js` | PASS | `evidence/producer-acceptance-node.json` |
| 飞书 8 类 draft 拦截 | `tests/fake-feishu-write.test.js`（10 用例） | PASS，0 外部写 | 测试输出 |
| 进程 cancel / artifact / MCP / 编排 | 单测套件（34+31 用例） | PASS | 会话测试输出 |
| Electron 真机 UI | `evidence/producer-electron-acceptance.js`（Playwright `_electron`） | PASS | `evidence/producer-electron-acceptance.json`、`evidence/screenshots/` |
| legacy 回退 | `KNOWME_TOOL_SURFACE=legacy` node + Electron 启动 | PASS | `producer-acceptance-node.json` |
| 开发静态 smoke | `evidence/tool-surface-electron-smoke.js` | PASS（标记/IPC） | 会话日志 |

## 真实环境未执行（不得伪造）

| 项 | 原因 | 负责方 |
|---|---|---|
| 真飞书授权 apply（doc/IM/task/calendar/drive/wiki/bitable） | 无用户明确批准的真实写账号 smoke | 测试 manual / 用户提供凭据 |
| Playwright MCP browser_navigate+snapshot | 本机未配置 Playwright MCP server | 测试 manual，见 `evidence/windows-smoke.md` C |
| 完整 Agent 对话触发 live apply_patch→批准→落盘 | 需 LLM API + 内容源绑定；fake eval 已覆盖逻辑 | 测试 QA 可选真机 |
| Hub Playwright 安装指引文案点击流 | 未在 Capability Hub 面板逐字走查 | 测试 QA |
| 子 Agent delegate 真机取消传播 | 单测覆盖；Electron 未跑 live Run | 测试 QA |

## 问题清单（按严重级别）

### BLOCKING
无。

### ADVISORY（交测试继续挑）
1. **审批卡信息层级**：`待确认` badge 与通用 hint 清晰，但风险等级/目标对象需展开 diff 才可见；建议在 summary 行增加 path/connector 摘要（`workspace-agent.js` `renderToolApprovalCard`）。
2. **Electron 审批 IPC 点击**：本次用 mock DOM 验证布局与 preload IPC 存在，未点击「批准/拒绝」完成真实 draft roundtrip（fake 单测已覆盖 approve/reject 逻辑）。
3. **开发 electron-smoke 仅为静态字符串检查**，不能替代真机；已由 `producer-electron-acceptance.js` 补充。
4. **mkdir 低风险管理**：符合 spec 允许空目录低风险直建；测试需在 Hub/allowlist 场景确认用户可理解。
5. **回滚 UI**：`.knowme/backups` 与 `applyFileDraft` 单测通过，制作人未在 UI 点击「回滚」。

## 是否可交测试 QA

**是。** 核心工具契约、外部写拦截、审批 UX 结构、legacy 回退与 Electron 壳启动均已验证；测试应聚焦 anti-pattern、manual 凭据 smoke、live Run 与 Hub 文案。
