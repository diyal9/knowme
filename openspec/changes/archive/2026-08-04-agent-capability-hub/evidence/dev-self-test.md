# 开发自测报告

- 日期：2026-08-04
- Change：agent-capability-hub 开发阶段收尾（§0–§10、§12 + 权限升级/Hub 连接器预览补全）
- npm test：**885 pass / 0 fail**（收尾 +2 用例；父 Agent 基线 883）
- npm run lint：**ok**
- Electron 重启：**2026-08-04 00:33**，日志含 `system/app-start`，无 uncaught error，仅开发态 CSP warning

## 自动化

| 检查 | 结果 |
|------|------|
| `npm test` | 885/885 PASS |
| `npm run lint` | PASS |
| `tests/agent-sandbox.test.js` | 含 `needsPermission` / `parseSandboxPermissionNeed` |
| `tests/capability-hub.test.js` | 含 connector preview / migrateLegacy 静态契约 |
| `tests/capability-integration.test.js` | IPC 22 通道、context、迁移、session |

## 本轮补全（相对父 Agent 基线）

### §10.3 per-run 权限升级
- `agent-sandbox.js`：`blockedResult.needsPermission` + `parseSandboxPermissionNeed`
- `main.js`：`tool.failed` 事件携带 `needsPermission`；`agent-run-update` 合并 `run.permissions`
- `workspace-agent.js`：工具失败时 `confirm` 提示并调用 `agentRunUpdate` 升级 Session 权限

### §6.5 Hub 连接器 preview
- `capability-hub.js`：连接器抽屉加载 `connector.health` + `toolsPreview` + allowlist 编辑/保存

### §4.6 legacy 迁移向导
- `capability-hub.js`：legacy 技能抽屉「迁移为标准技能」→ `skill.migrateLegacy`

## 接线清单（已落地）

### main.js
- `ensureCapabilityHub()` + 启动迁移 + IPC
- `agent-session-list` 排除 ephemeral + `expertName`
- `agent-session-new` 支持 expertId + snapshot
- `ai-generate`：context assembly + skill 工具 + connector 过滤
- `list-skills` 双轨

### preload / lib / workspace
- `window.knowme.{capability,skill,expert,connector}` 22 通道
- `capability-hub-service.js`、`agent-context-assembly.js`、`agent-sessions.js`
- slash / 专家 picker / Tab expertName / 空状态 CTA

## UI 证据（Playwright 静态）

路径：`openspec/changes/agent-capability-hub/evidence/screenshots/`（*.png 已 gitignore，本地由父 Agent Playwright 静态页生成）

| 文件（预期） | 内容 |
|-------------|------|
| `hub-tab-skills.png` | 技能 Tab 列表 |
| `hub-tab-experts.png` | 专家 Tab 列表 |
| `hub-tab-connectors.png` | 连接器 Tab 列表 |
| `hub-drawer-detail.png` | 详情抽屉 |

**限制**：静态 HTML 冒烟（`capability-hub.html` iframe），非 Electron 真机 IPC；未覆盖 slash picker、JIT 卡片、试聊 ephemeral。

## 真机待验（§11.3 / 制作人 / 测试）

1. Hub 安装 curated、本地/ZIP/HTTPS needsTrust、自定义创建
2. 选 Hub 专家 → Tab expertName → persona 生效；试聊不入主 Tab
3. `/slash` 标准 skill L1 + legacy OKF
4. `run_skill_script` 沙箱 chroot；权限 confirm 后下轮 run 生效
5. connectors.json 升级迁移；飞书 JIT 不退化
6. 连接器 health + tools preview 真 MCP 探测

## 备注

- 未 git commit / 未 `/opsx:archive`
- `tasks.md` 已勾选 §0–§10、§12、§11.1/11.2/11.5/11.8；§11.3–11.4/11.6–11.7/11.9 留后续
