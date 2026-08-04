# Code Review: agent-capability-hub

- 日期：2026-08-04
- 审查范围：Capability Hub 全栈（store/import/runtime/IPC/UI/上下文/Session/沙箱）
- 结论：**通过** — 架构清晰、安全边界可接受；制作人验收、QA 与 Story gate 均已通过

## 架构

| 层 | 评价 |
|----|------|
| 存储 | `capability-store` + atomic install-store；bundled catalog overlay 合理 |
| Runtime | skill/expert/connector 三 runtime 分离；`capability-hub-service` 统一 IPC 门面 |
| 上下文 | `agent-context-assembly` 快照优先 + L0/L1 + legacy 双轨，职责单一 |
| UI | `capability-hub.html` iframe + rail 路由；bridge fallback 支持离线预览 |
| Session | `expertId` / `snapshotPath` / ephemeral 试聊与主 Tab 隔离 |

**优点**：main 仅 orchestrate，业务在 lib；preload 双轨 `knowme.*` + `api.*` 兼容旧调用。

**待跟进**：`agent-run.normalizeRun` 未正式 schema 化 `permissions` 字段（当前由 main 侧 merge 绕过 normalize 剥离）。

## 安全

| 项 | 状态 |
|----|------|
| 沙箱禁网 | Python `-I` + import denylist；node `-e` 禁；shell denylist |
| run 级 permissions | 默认 false；blocked 带 `needsPermission`；UI confirm 后写入 session |
| 导入 | ZIP traversal/大小/secret 扫描；HTTPS only + needsTrust |
| Renderer | 无 direct fs；capability 操作经 IPC |
| Connector allowlist | Hub 可编辑；MCP 工具面仍投影过滤 |

**风险（可接受）**：用户 confirm 后可开启 network/write/dangerous — 符合显式授权设计；dangerous 仍 requiresApproval 语义保留。

## 兼容性

- 启动迁移 `connectors.json` → `capabilities/connectors/`（`.bak` + flag）
- legacy OKF slash 双轨；Hub 一键导出 SKILL.md
- 设置页 legacy banner 指向 Hub rail
- 旧 `list-skills` / feishu 连接器路径保持

## 风险与限制

1. **权限升级非同窗重试**：confirm 升级 `session.run.permissions` 后，当前 ai-generate 轮次内沙箱工具面不热更新；需用户重发或下轮 run（已在 UI 文案说明）。
2. **Hub 连接器 preview**：MCP health 依赖本地命令/网络；静态 Playwright 无法验 IPC。
3. **真机 E2E 范围**：Electron 已完成启动冒烟；安装、试聊、slash/JIT 的真机点击列为 QA advisory，不阻塞本 Story。
4. **normalizeRun 字段**：expertId/snapshotPath/permissions 等扩展字段依赖 session 持久化 JSON 直通，normalizeRun 可能丢弃未列字段 — 已观察 `permissions` 需旁路 merge。

## 测试覆盖摘要

- 单元：store、import、skill/expert runtime、sandbox、mcp-host、connectors
- 集成：`capability-integration.test.js`
- 静态：Hub DOM/rail/bridge 契约
- 缺口：Electron E2E、HTTPS trust 对话框、双 MCP 并行真机

## 建议（非阻塞）

- 后续 Story：将 `run.permissions` 纳入 `agent-run.normalizeRun` 正式字段
- 同 run 内热更新 sandbox permissions（可选，提升 §10.3 体验）
- 后续 E2E Story 可补 JIT/slash 真机截图与自动化驱动
