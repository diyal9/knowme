## Context

当前工具层现状（调查摘要）：

| 模块 | 能力 | 缺口 |
|---|---|---|
| `agent-tools.js` | `createToolSurface`、allowlist、`search_knowledge`、结果截断 | 无统一契约 registry；`_knowme` 元数据未强制 |
| `agent-file-tools.js` | `read_file/list_dir/grep_files` 只读 | 无 write/patch/move/delete/mkdir |
| `agent-sandbox.js` | `run_python/run_shell`、权限模型、危险命令拦截 | 非结构化任务；无 task_status/logs/cancel |
| `agent-web-tools.js` | `fetch_web_page` 静态抓取 | 无交互式浏览器自动化 |
| `mcp-host.js` | stdio JSON-RPC、多 connector、`mcp.<id>.<tool>` 投影 | 无 HTTP/OAuth/health/schema cache |
| `tool-runtime.js` | Feishu read + 2 draft + MCP 投影 | 飞书写类型少；draft 与 file write 未统一 |
| `agent-run-executor.js` | 工具循环、45s 超时、trace、预算 | 无子 Run / 并行 orchestration |
| UI 时间线 | 增量 DOM、折叠结果、`runPhase` | 无审批卡、artifact 链、缺失工具提示 |

6 个活跃 change 与本 Story **文件路径零交叉**；实现时通过 feature flag `KNOWME_TOOL_SURFACE=v1|legacy` 渐进启用，默认 v1 在 tasks 全完成后切换。

## Goals / Non-Goals

**Goals:**

- 单一 Registry 驱动 Agent 投影、Hub 预览、Eval fixture 与审计日志
- 写操作统一「预览 → 批准 → 执行 → 审计」；读/低风险工具保持低摩擦
- 分 4 个实现 Phase（见 tasks.md），每 Phase 有硬门禁后再进入下一 Phase
- 主进程执行所有副作用；渲染进程仅 IPC + 审批 UI
- Fake MCP / Fake Feishu 使 CI **零凭据**覆盖 ≥80% 场景

**Non-Goals:**

- 不合并/修改 6 个活跃 change 的代码或 spec
- 不在首版实现完整 MCP OAuth 服务器（仅客户端配置 + token 存储 + 刷新钩子）
- 不将 Workbench Daemon DAG 引擎迁入 Agent Run（仅 IPC handoff 与 artifact 对齐）

## Decisions

### D1: Tool Contract 作为唯一注册源

**选择**：新增 `tool-contract-registry.js`，所有工具定义经 `registerTool(def, contract)` 进入 Registry；`createToolSurface` 只从 Registry 投影。

**理由**：避免 `agent-tools`、`tool-runtime`、MCP、Feishu 各自维护 `_knowme` 碎片。

**备选**：继续 `_knowme` 松散字段 — 拒绝，无法做 Hub 风险治理与 eval 契约断言。

### D2: 写文件与飞书写共用 Draft Store

**选择**：扩展 `%APPDATA%\KnowMe\connector-drafts.json` 为通用 `tool-drafts.json`（version 2），条目含 `kind: file|feishu|mcp`、preview、idempotencyKey、rollbackPlan。

**理由**：已有 `approveFeishuDraft` 模式可复用；用户单一审批 UX。

**备选**：文件写即时执行 — 拒绝，违背产品安全与 Non-goals。

### D3: 浏览器自动化 = Playwright MCP 适配层

**选择**：不内嵌 Chromium；提供 `browser-mcp-adapter.js` 映射标准工具名到已配置的 Playwright MCP connector；域名策略在主进程 enforce。

**理由**：MCP 生态已有 Playwright server；减少 Electron 包体积与升级负担。

**备选**：Puppeteer in-process — 拒绝，内存与安全边界差。

### D4: 进程工具分层

**选择**：

- `run_shell/run_python` — 保留沙箱（已有）
- `run_task` — 结构化模板（npm test/lint/build）+ cwd 限制在内容源或 run 临时目录
- `start_process` — 长任务后台化，Run 级 registry，cancel 传播 SIGTERM→SIGKILL

**理由**：结构化任务可 eval、可审计；任意 shell 仍走 sandbox 权限。

### D5: 产物工具首版边界

**选择**：

- ✅ Markdown/txt artifact CRUD（内存 + 可选落盘到内容源 `artifacts/`）
- ✅ CSV 从 JSON/表格数据导出
- ✅ PDF：HTML/Markdown → 本地 print-to-pdf（Electron `webContents.printToPDF`）仅 **≤20 页**
- ❌ docx/pptx 原生、云端 PDF API、Excel 公式

**理由**：避免虚假能力；PDF 用现有 Electron 能力无新依赖。

### D6: MCP HTTP + OAuth（Phase 3）

**选择**：`mcp-host.js` 增加 transport 抽象 `stdio | streamable-http`；OAuth 存 `%APPDATA%\KnowMe\mcp-oauth\<connectorId>.json`；schema 缓存 `%APPDATA%\KnowMe\mcp-schemas\`。

**理由**：与 MCP 2025 spec 方向一致；stdio 保持默认。

### D7: Agent Orchestration 与 Expert Runtime

**选择**：新增 `delegate_to_expert` / `spawn_sub_run` 工具（预算：每 Run ≤2 子 Run、≤1 并行）；子 Run 复用 `AgentRunExecutor` + 独立 session slice；handoff payload 经 `workbench-daemon-client` 可选同步。

**理由**：与 `load-agent-experts-from-daemon` 正交 — 本 Story 定义工具契约，不修改 daemon 加载 UI。

### D8: Electron / IPC 边界

```
Renderer (workspace.js)
  ↔ preload: tool-approve, tool-draft-list, process-cancel, artifact-open
Main (main.js)
  → tool-contract-registry
  → agent-*-tools / mcp-host / feishu-cli
  → child_process / fs (scoped)
```

渲染进程 **MUST NOT** 直接 spawn 或 fs.write。

### D9: Feature flag 与回滚

- `KNOWME_TOOL_SURFACE=legacy` — 仅旧只读文件 + 现有 Feishu draft
- `KNOWME_TOOL_SURFACE=v1` — 全量新工具（tasks 完成后默认）
- 回滚不影响已写入磁盘数据；draft 文件向前兼容 v1→v2 迁移

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 范围过大单 Story 交付困难 | 4 Phase + 硬门禁；Phase 1 即可独立 ship 契约+文件写 |
| Playwright MCP 用户未安装 | Hub 显示「缺失能力」+ 安装指引；eval 用 fake MCP |
| 飞书写 API 权限复杂 | 全部 draft；apply 失败返回 scope 原文；幂等键防重复 |
| 文件写破坏用户内容 | 写前 backup 到 `.knowme/backups/<runId>/`；拒绝路径 traversal |
| 子 Agent 成本/循环 | 子 Run 预算、深度≤1、trace 可见 |
| 与 6 活跃 change 冲突 | 路径隔离 + code review 检查 touch list |
| Windows 进程取消不干净 | taskkill / tree-kill；单测 mock spawn |

## Migration Plan

1. **Phase 0（本 planning）**：OpenSpec 工件 apply-ready
2. **Phase 1**：Registry + 文件写 draft + 契约测试（无 UI 改版）
3. **Phase 2**：进程/artifact + Tool UX 审批卡 + 飞书写 draft 扩展
4. **Phase 3**：MCP HTTP/OAuth + 浏览器 MCP 适配
5. **Phase 4**：Orchestration + E2E eval + Windows smoke
6. 每 Phase 结束：`npm test` + phase gate JSON + 制作人验收子集
7. 全量完成后默认 `KNOWME_TOOL_SURFACE=v1`；legacy 保留 ≥1 版本

## Open Questions

（无阻塞 apply 的开放项；下列可在 Phase 内决策）

- PDF 样式模板是否复用便签 typography token — Phase 2 UI 决定
- Playwright MCP 默认推荐 package 名称 — Hub 文案 Phase 3 填写
