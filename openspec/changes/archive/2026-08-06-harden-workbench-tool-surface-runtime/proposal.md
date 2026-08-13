## Why

`strengthen-workbench-tool-surface` 已交付完整工具面基线并通过 QA，但独立 code review 与反模式评估暴露 **13 项运行时加固缺口**（3 HIGH / 6 MEDIUM / 4 LOW）：Registry 未接入 Agent 生产热路径、Run 取消未传播至子 Run、`start_process` 存在 shell 绕过风险、浏览器 blockedHosts 误返回 approval、生产 IPC 可被渲染层注入测试开关、Draft store 并发竞态、move 回滚不完整、mkdir 用户认知模糊、内存 store 无 eviction、审计链不完整等。这些缺口会在真实办公场景下造成安全误放行、资源泄漏与审批 UX 误导，必须在**独立 change** 中系统性加固，且不触碰 6 个并行活跃 change。

## What Changes

- **H1 — Registry 生产热路径**：`buildFullToolSurface` / Registry 成为 Agent Run **唯一**工具组装入口；统一契约校验、result envelope、审计；明确 `KNOWME_TOOL_SURFACE=v1|legacy` 兼容与 legacy 回退行为。
- **H2 — Run 取消传播**：`ai-cancel-run` MUST 取消 orchestration 子 Run；实现并传入 `cancelSubRun`；预算停止、状态一致；Electron E2E 验证无子任务泄漏。
- **H3 — start_process 加固**：禁止任意命令绕过 sandbox；消除或严格控制 Windows `shell:true`；与 sandbox 共用 allowlist/审批/危险命令/网络策略；参数注入防护（PowerShell/node）。
- **M1 — Browser blockedHosts 硬拒绝**：localhost/内网 MUST 返回 `scope_denied`，不得误返回 `approval_required`；首次非 blocked 域名确认与 allowlist 逻辑可完成且不误导。
- **M2 — 生产 IPC 测试开关隔离**：渲染层禁止传 `fakeApply`/测试开关；测试注入经明确 test-only seam；审计含 approver/session/run。
- **M3 — Draft store 并发 CAS**：pending→applying→applied 状态机；双窗口/重复批准 CAS；Windows rename EPERM 重试。
- **M4 — move_path 双向回滚**：source/target 同时正确处理；失败中间态可恢复。
- **M5 — mkdir 产品决策**：**保留**内容源内空目录「低风险直建」（无 draft），时间线 MUST 展示可读路径 +「低风险直建」标签；内容源外或冲突路径走 draft；可测标准见 acceptance。
- **M6 — 运行时 store eviction**：processRegistry/artifactStore/runStates TTL、容量上限、重启/旧 id 友好提示。
- **L1 — 审计链加固**：字段完整、写失败可见、敏感字段脱敏、最小 tamper-evident hash chain（不宣称不可抵赖）。
- **L2 — 路径 symlink/junction**：realpath/lstat、创建目标父路径验证、Windows junction 负例。
- **L3 — 批准 IPC 合并**：重复批准入口共享单实现，兼容代理保留。
- **L4 — Tool UX 补全**：toolTimelineTitle/审批卡为 write/patch/move/飞书 draft 提供可读对象摘要；pending 按钮禁用+loading；UI rollback 入口；Hub Playwright 安装点击流。

## 目标用户

- **办公伙伴用户**：需要可信赖的审批、取消与回滚，避免误写、误导航内网、取消后子任务仍在跑。
- **企业管理员 / 专家作者**：需要审计可追溯、进程不可任意 spawn、测试开关不可被渲染层滥用。
- **开发 / QA**：需要 fake/CI 完整覆盖 + 凭据类 manual SKIP 脚本，量化加固回归。

## 验收标准（可量化）

| 指标 | 门槛 |
|---|---|
| Registry 生产路径 | Agent Run 100% 经唯一组装入口；legacy/v1 切换单测 + eval 覆盖 |
| Run 取消 | 父 Run cancel 后 **≤3s** 子 Run 终态 `CANCELLED`；0 泄漏 running 子任务（mock + Electron E2E） |
| start_process 安全 | 任意 shell 绕过负例 **100%** 拒绝；PowerShell/node 注入负例 **100%** 拦截 |
| blockedHosts | localhost/127.0.0.1/内网 RFC1918 **100%** `scope_denied`；0 次 `approval_required` |
| Draft 并发 | 快速连点 + 跨窗口批准：仅 1 次 apply；双批准第二次 `not_pending` |
| move 回滚 | 失败中间态恢复单测 **100%** pass |
| mkdir UX | 直建场景时间线含路径摘要 +「低风险直建」；draft 场景含批准卡 |
| Store eviction | 超 TTL/容量后旧 id 返回可读 `not_found`/`expired`；重启不 crash |
| 审计 | side-effect 工具 audit 字段 ≥10 项；OAuth token 日志 **0** 明文 |
| 回归 | `npm test` + `npm run lint` 全绿；新增 **≥35** 加固专项用例 |
| 活跃 change 隔离 | git diff **0** touch 6 活跃 change 路径 |
| 真机 optional | 飞书真 apply / Playwright MCP / live Agent 审批：有凭据 manual，无凭据 **SKIP**（不伪造 PASS） |

## 非目标（Non-goals）

- **不修改** 6 个活跃 change 的代码或 spec：`align-workbench-workflow-catalog`、`feishu-connection-empty-state`、`launch-dialog-progressive-disclosure`、`load-agent-experts-from-daemon`、`polish-link-preview-toolbar`、`restore-unified-knowme-brand-icon`
- 不重做 `strengthen-workbench-tool-surface` 已交付的工具清单与 Hub 整体布局
- 不实现完整 MCP OAuth 服务器或远程能力市场
- 不将 audit hash chain 宣称为法律级不可抵赖
- 不在 CI 硬依赖真实 LLM / 真实飞书写 / 真实 Playwright（凭据项标记 manual/SKIP）
- 本阶段 **仅规划**，不实现代码、不 git commit

## Capabilities

### New Capabilities

（无 — 全部为既有 capability 的行为加固 delta）

### Modified Capabilities

- `tool-contract-registry`: 生产热路径唯一组装、envelope/审计强制、legacy 兼容
- `agent-tool-execution`: 执行前契约校验、test-only seam、store eviction 钩子
- `agent-run-executor`: ai-cancel-run 子 Run 取消传播与状态一致
- `agent-orchestration`: cancelSubRun 实现、预算停止、子 Run 泄漏检测
- `workbench-process-tools`: start_process 加固、与 sandbox 策略统一、注入防护
- `workbench-browser-automation`: blockedHosts 硬拒绝、首次域名确认分离
- `workbench-file-tools`: move 双向回滚、mkdir 决策与反馈、symlink/junction
- `connector-feishu-write-review`: Draft CAS 状态机、IPC fakeApply 隔离、批准 IPC 合并
- `workbench-artifact-tools`: artifactStore TTL/容量与旧 id 体验
- `tool-ux`: 审批摘要、pending loading、rollback UI、Hub 安装点击流
- `agent-thinking-timeline`: toolTimelineTitle 可读对象摘要
- `capability-hub`: Playwright 安装指引可点击验证
- `content-sources`: 路径 realpath/lstat 与 junction 负例

## Impact

| 区域 | 变更 |
|---|---|
| `src/lib/tool-surface-builder.js` | 成为 Agent Run 唯一入口；legacy 分支 |
| `src/lib/agent-tools.js` / `agent-run-executor.js` | Registry 投影、cancelSubRun 接线 |
| `src/lib/agent-orchestration.js` | 取消传播、预算停止 |
| `src/lib/agent-process-tools.js` / `agent-sandbox.js` | start_process 加固、策略共用 |
| `src/lib/browser-mcp-adapter.js` | blockedHosts 硬拒绝、内网检测 |
| `src/lib/tool-drafts-store.js` | CAS 状态机、EPERM 重试 |
| `src/lib/agent-file-tools.js` / `file-backup.js` | move 回滚、symlink、mkdir UX |
| `src/lib/tool-audit.js`（或等价） | 字段、脱敏、hash chain |
| `src/main.js` / `preload.js` | IPC 合并、test-only seam、fakeApply 剥离 |
| `src/workspace-agent.js` | 审批摘要、rollback、pending loading |
| `tests/*` + `evidence/*` | 加固专项、反模式、Electron E2E、optional 凭据脚本 |
| 6 个活跃 change | **零 touch** |

前置依赖：已归档 `2026-08-06-strengthen-workbench-tool-surface` 主 spec 同步完成。
