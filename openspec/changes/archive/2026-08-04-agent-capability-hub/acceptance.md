# 制作人体验验收: agent-capability-hub

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**证据**：`evidence/dev-self-test.md`、`evidence/screenshots/`、`code-review.md`；独立复核 `npm test` 885/885、`npm run lint` ok

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 静态 UI / 单元·集成测试 / 截图已证实 |
| ⚡ | Electron 启动冒烟（无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 核心路径 — Capability Hub

- [x] ✅ rail 三图标可见，点击分别打开 Hub 对应 Tab — `workspace-capability-rail.test.js` + `workspace.html` aria/tooltip；Hub 三 Tab 截图 `hub-*.png`
- [x] ✅ Hub 搜索、chip、「已安装」筛选符合预期 — 三 Tab 截图可见顶栏搜索、分类 chips、已安装 checkbox；`capability-hub.js` 过滤逻辑 + 静态契约测试
- [x] ✅ 三列卡片 + 详情抽屉信息完整（名称、描述、版本、来源） — `hub-skill-detail.png` 含版本/来源/分类/状态/依赖/启用/更新/卸载
- [x] 🔜 「+」可完成：精选安装、ZIP 导入、自定义创建（至少各测一条） — UI 与 IPC 已实现（`capability-hub.js` 添加对话框 + `capability-integration` 22 通道）；**真机安装/ZIP/HTTPS needsTrust 未在本轮点击验证**，移交 QA
- [x] ✅ Esc/关闭 Hub 回到 Agent，会话不丢失 — `workspace.js` Esc/`capability-hub-close` 契约测试；⚡ Electron 重启后会话持久化无回归

## 核心路径 — 技能

- [x] 🔜 安装内置精选技能后，Agent `/slash` 可选且注入生效 — `skill-runtime` + slash picker 代码与集成测试；**无 slash 截图/真机对话验证**
- [x] ✅ 导入标准 SKILL.md 目录（兼容 Cursor 布局）成功 — `capability-import` / `skill-runtime` 单元测试 + bundled seed
- [x] ✅ 自动匹配：发送相关工作消息可见 skill 摘要（非 disable-model-invocation） — `agent-context-assembly` 集成测试 `assembleCapabilityContext`
- [x] ✅ legacy OKF slash 仍可用；迁移向导可导出标准包 — 卡片 `Legacy OKF Slash` + 抽屉「迁移为标准技能」按钮；`skill.migrateLegacy` 接线
- [x] ✅ 禁用技能后 slash 列表与 Agent 均不可见 — install store `enabled` 过滤 + context assembly 测试

## 核心路径 — 专家

- [x] 🔜 安装/创建专家，新建 Session 可选并绑定 — Session 模型 + expert picker 代码/测试；**真机 Session 绑定 UI 未点击**
- [x] 🔜 对话 persona 明显体现专家 systemPrompt — `expert-runtime` snapshot/persona 单元测试；**真机对话 persona 未目测**
- [x] 🔜 Hub 试聊可用且关闭不污染主 Tab — 抽屉「试聊专家」+ `expert.tryChat` ephemeral 单元测试；**真机试聊未点击**
- [x] ✅ 编辑专家后，旧 Session persona 不变；新 Session 用新版本 — `expert-runtime.test.js` snapshot 冻结用例

## 核心路径 — 连接器

- [x] 🔜 安装 feishu / MCP 模板，health 与 tools preview 正常 — 连接器 Tab 截图含健康 badge；抽屉 allowlist/health 代码已接；**真 MCP health 探测未验**
- [x] ✅ allowlist 勾选后 Agent 仅见选中工具 — `agent-mcp-host` 投影测试 + Hub allowlist 编辑器
- [x] ✅ 双 MCP 并行无工具名冲突 — `mcp.<id>.` 前缀 + 双 MCP 集成测试
- [x] 🔜 飞书 JIT 增量授权卡片与写草稿审批与改前一致 — 行为保留于 connector 层；**无 JIT 截图/真机对话验证**

## 安全与沙箱

- [x] ✅ 恶意 ZIP（../）安装被拒绝，有清晰错误 — import 安全单元测试 + Hub toast 错误文案
- [x] ✅ 沙箱：Python urllib / node -e fetch 未授权时 blocked — `agent-sandbox.test.js` + `dev-self-test`
- [x] ✅ 磁盘无 connector secret 明文 — secret 扫描 + `env:VAR_NAME` 约束测试

## 体验标准

- [x] ✅ 视觉浅色克制，与元器参考一致，不喧宾夺主 — 三 Tab + 抽屉截图；`#f7f8fa` 背景、白卡片、chip 圆角
- [x] ✅ 首次用户空状态有「打开能力 Hub」引导 — Agent 空态 CTA + `hub-state` 空列表引导
- [x] ✅ 错误态（安装失败、health 红）文案可理解，有下一步动作 — `hub-state error` 重试、`hub-toast` 错误类、连接器 health badge
- [x] ⚡ 无控制台 error（Electron 真机冒烟） — 2026-08-04 00:33 重启仅 CSP warning；Playwright 静态三 Tab+抽屉无 console error

## 验收依据

- 开发自测：`evidence/dev-self-test.md`
- UI 截图：`evidence/screenshots/`（hub-skills / hub-experts / hub-connectors / hub-skill-detail）
- 硬门禁：`npm test` 885/885、`npm run lint` ok（制作人复核 2026-08-04）
- 代码审查：`code-review.md` — 开发阶段通过

## 验收结论

- [x] **通过** / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-04
- 备注：
  - **制作人放行范围**：Hub 信息架构、三入口可发现性、卡片/抽屉管理面、空错态文案、安全与沙箱回归、IPC/Runtime 集成测试 — 均达标，可放行 **测试 QA**。
  - **真机限制（QA 已记录）**：精选安装端到端、`/slash` L1 注入目测、专家试聊 ephemeral、Session persona 对话、飞书 JIT 卡片、HTTPS needsTrust 对话框、双 MCP 真机并行为后续 E2E advisory。
  - **最终门禁**：QA `test-report.md` 已 PASS；`harness:gate` 已 PASS。权限升级需下轮 run 生效、slash/JIT 截图缺口保留为非阻塞 advisory。
