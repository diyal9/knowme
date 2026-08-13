## Why

KnowMe 工作台 Agent 已具备只读文件、沙箱脚本、飞书只读/单点草稿写入与 stdio MCP 投影，但**无法完成「理解→查找→修改→执行→验证→交付」闭环**：缺写入/补丁/移动/删除、结构化进程任务、浏览器自动化、产物导出、统一 Tool Contract、子 Agent 编排与系统化飞书写能力。工具层分散在 `agent-tools`、`agent-file-tools`、`agent-sandbox`、`mcp-host`、`tool-runtime` 等多模块，契约与 UX 不一致，外部写操作仅覆盖 `feishu.draft_write_doc`，难以支撑办公伙伴「查资料→改文档→跑验证→发消息/建任务」的真实工作流。

在 6 个并行活跃 change 推进 UI/专家/品牌等体验时，必须**独立**建立完整、可测、可审批的工具层基线，避免与现有 change 混改；否则后续每个 Story 都会重复补工具、重复踩安全与审批坑。

## What Changes

- **统一 Tool Contract / Registry**：所有内置、Connector、MCP、飞书工具注册为带 `source/capability/risk/approval/scope/timeout/idempotency/rollback/health/audit` 的契约；执行结果统一 envelope（ok/code/text/preview/artifactRefs/auditId）。
- **工作区文件写工具**：在现有 `read_file/list_dir/grep_files` 上增加 `write_file/create_file/apply_patch/move_path/copy_path/delete_path/mkdir`；路径作用域绑定活跃内容源；写/删/移动默认预览→用户批准→执行→备份/回滚。
- **进程与任务工具**：`start_process/run_task/task_status/task_logs/cancel_task`；内置 `npm test/lint/build` 结构化任务模板；超时、输出上限、后台进程治理与 Run 取消联动。
- **浏览器自动化**：通过 Playwright MCP 适配层投影 `browser.*` 工具（navigate/snapshot/click/type/form/upload/download）；域名 allowlist + 首次跨域用户确认；**不**内嵌浏览器内核。
- **产物工具（首版边界明确）**：Markdown/纯文本 artifact 创建与更新、CSV 表格导出、本地 PDF 导出（基于已有内容/HTML）；**首版不支持** Word/PPT 原生编辑、云端 PDF 服务、虚假「已上传」状态。
- **MCP 增强**：在 stdio 之外规划 Streamable HTTP transport、OAuth/认证配置、schema 缓存、健康检查、安装/启用、allowlist、超时与断线恢复；Hub 与 Agent 投影一致。
- **Agent 编排**：专家/子 Agent 委派、有限并行、handoff、结果汇总、取消与 trace 可观察性；与 Workbench Daemon / Expert runtime 对齐，不替代 daemon DAG。
- **飞书写能力套件**：文档创建/更新/追加，IM 发送/回复，任务创建/更新/完成，日历创建/更新/取消，云盘上传/移动/文件夹，Wiki 节点创建/移动，多维表格记录增删改；**全部**走「预览/草稿→用户批准→执行→审计」；幂等键、重试边界、权限错误清晰；**严禁**默认直写生产外部系统。
- **Tool UX**：工具发现、缺失能力提示、权限预检、审批卡、执行进度/日志/取消、结果与 artifact 展示、失败恢复入口。
- **测试体系**：单元、契约、集成（fake MCP / fake Feishu）、安全负例、超时/取消/重试/幂等、Electron E2E、Windows 真机 Smoke、工具选择 eval；区分无需真实账号 vs 需用户凭据的用例。

## 目标用户

- **知识工作者 / 办公伙伴用户**：希望在 KnowMe 内完成读文件→改文档→跑测试→发飞书/建任务，而不切换 IDE+浏览器+飞书多端。
- **专家作者 / 企业管理员**：需要在 Capability Hub 中理解工具风险、审批策略与 Connector 健康，安全启用写能力。
- **开发 / QA**：需要 deterministic 契约测试与 eval，量化「闭环完成率」而非工具数量。

## 验收标准（可量化）

| 指标 | 门槛 |
|---|---|
| **闭环 E2E（fake 环境）** | 固定场景「读 README → apply_patch 改一行 → run_task npm test → 生成 Markdown artifact → feishu.draft 消息（不 apply）」eval 通过率 **100%**（hard gate） |
| **外部写默认拦截** | 未批准 draft 时，0 次真实 Feishu/MCP 写 API 调用（fake spy 断言） |
| **Tool Contract 覆盖** | 注册表内 **100%** 工具具 `_knowme` 或等价契约字段；缺字段的工具不得进入 Agent 投影 |
| **审批 UX** | 写文件/飞书写/MCP 高风险工具：100% 展示预览卡；用户拒绝后 0 副作用 |
| **取消与超时** | 长任务 cancel 后 **≤3s** 停止子进程；超时返回可恢复错误码 |
| **回归** | `npm test` + `npm run lint` 全绿；新增 **≥40** 工具层单测/契约用例；6 个活跃 change 相关用例无退化 |
| **真机 Smoke（可选凭据）** | Windows：启用 Playwright MCP + 飞书已授权时，浏览器 snapshot 与 feishu.draft 各 1 条手动 smoke 通过（**不伪造**无凭据通过） |

## 非目标（Non-goals）

- 不修改、不依赖、不破坏 6 个活跃 change：`align-workbench-workflow-catalog`、`feishu-connection-empty-state`、`launch-dialog-progressive-disclosure`、`load-agent-experts-from-daemon`、`polish-link-preview-toolbar`、`restore-unified-knowme-brand-icon`
- 不重写 AgentRunExecutor 状态机或 Grounding 内核（仅扩展 tool ports / trace）
- 不实现远程能力市场、多租户 OAuth Gateway、自研浏览器引擎
- 首版不做：Feishu 全量 OpenAPI 覆盖、BI 级多维表格公式、PDF OCR、Word 在线协同
- 不将 `brain/` 或 `%APPDATA%` 产品记忆层改为 Agent 默认可写范围（须显式内容源绑定）
- 不在 CI 硬依赖真实 LLM / 真实飞书 / 真实 Playwright 浏览器（凭据类测试标记 `manual` / `requires-env`）

## Capabilities

### New Capabilities

- `tool-contract-registry`: 统一 Tool Contract、Registry、结果 envelope、schema 校验与审计 ID。
- `workbench-file-tools`: 工作区写/补丁/移动/复制/删除/建目录，路径作用域、预览、审批、备份与回滚。
- `workbench-process-tools`: 进程与结构化任务（npm test/build/lint 等），状态/日志/取消/超时治理。
- `workbench-browser-automation`: Playwright MCP 适配的浏览器自动化与安全域名策略。
- `workbench-artifact-tools`: Markdown/CSV/PDF 产物创建、更新、导出与 artifact 生命周期（首版边界）。
- `agent-orchestration`: 子 Agent/专家委派、并行、handoff、汇总、取消与可观察性。
- `tool-ux`: 工具发现、缺失提示、权限预检、审批卡、进度/日志/取消、结果与失败恢复 UI。

### Modified Capabilities

- `agent-tool-execution`: 扩展 recoverable 分类、契约 envelope、写工具与进程工具的执行边界。
- `agent-mcp-host`: Streamable HTTP、OAuth、schema 缓存、健康检查、安装/启用与断线恢复。
- `agent-thinking-timeline`: 审批卡、工具健康、artifact 与 orchestration 步骤的可读展示。
- `connector-feishu-write-review`: 扩展 draft 类型覆盖文档/IM/任务/日历/云盘/Wiki/Bitable 写操作。
- `agent-run-executor`: 子 Run 编排、并行预算、handoff 与取消传播。
- `expert-runtime`: 专家可声明 orchestration 策略与工具子集（与 allowlist 对齐）。
- `capability-hub`: MCP/Connector 工具预览、健康、安装启用与风险确认。
- `content-sources`: 写工具路径作用域与内容源根目录策略。

## Impact

| 区域 | 变更 |
|---|---|
| `src/lib/tool-contract-registry.js`（新） | 契约模型、注册、校验、envelope |
| `src/lib/agent-file-tools.js` | 扩展写/补丁/移动/删除 |
| `src/lib/agent-process-tools.js`（新） | 进程与结构化任务 |
| `src/lib/agent-artifact-tools.js`（新） | 产物 CRUD/导出 |
| `src/lib/browser-mcp-adapter.js`（新） | Playwright MCP 投影与安全策略 |
| `src/lib/agent-orchestration.js`（新） | 子 Agent / handoff |
| `src/lib/mcp-host.js` | HTTP transport、OAuth、健康 |
| `src/lib/connectors/feishu-cli.js` + drafts | 扩展写 draft 与 apply |
| `src/lib/connectors/tool-runtime.js` | 契约注册与审批桥接 |
| `src/lib/agent-tools.js` | 契约感知 validate/execute |
| `src/main.js` / `workspace.js` | IPC：审批、进程、artifact |
| `tests/*` | 契约、fake MCP/Feishu、E2E、eval |
| 6 个活跃 change | **无代码 touch**；仅并行存在 |

依赖：可选 dev 依赖 `@playwright/test` 或文档化外部 Playwright MCP server；不新增运行时 npm 包硬依赖（MCP server 用户自备）。
