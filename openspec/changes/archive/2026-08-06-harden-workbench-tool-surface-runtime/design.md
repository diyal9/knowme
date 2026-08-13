## Context

`strengthen-workbench-tool-surface` 已归档，主 spec 含 15 个 capability。当前实现调查摘要：

| 模块 | 现状 | Review 缺口 |
|---|---|---|
| `tool-surface-builder.js` | `buildFullToolSurface` 存在 | Agent Run 热路径仍调 `createToolSurface`（`tool-runtime.js`、`main.js`） |
| `agent-orchestration.js` | 接受 `cancelSubRun` 回调 | `ai-cancel-run` 未传入；子 Run 可能泄漏 |
| `agent-process-tools.js` | `start_process` 可 spawn | 未与 sandbox allowlist 完全共用；Windows shell 风险 |
| `browser-mcp-adapter.js` | blocked + confirm 分支 | blocked 域名可能落入 `approval_required` |
| `main.js` IPC | `fakeApply` 来自 payload | 渲染层可注入 |
| `tool-drafts-store.js` | 幂等键 + pending | 无 applying CAS；EPERM 无重试 |
| `file-backup.js` | 写前 backup | move 失败中间态 rollback 不完整 |
| audit | append-only jsonl | 字段不全；无 hash chain；敏感未脱敏 |

6 个活跃 change 路径零交叉；本 change 仅加固运行时，不扩展新工具类型。

## Goals / Non-Goals

**Goals:**

- 单一生产入口：`resolveToolSurfaceForRun(runCtx)` → Registry 投影 → validate → execute → envelope → audit
- 取消、并发、回滚、eviction 在 fake/CI 可 deterministic 验证
- 产品决策 M5：**mkdir 内容源内空目录直建 + 明确时间线反馈**（非统一 draft）
- test-only seam：`NODE_ENV=test` 或 `KNOWME_TEST_SEAM=1` 主进程注入，渲染 IPC 永不接受 fake 开关

**Non-Goals:**

- 不修改 6 活跃 change
- 不重写 AgentRunExecutor 阶段机
- 不新增 npm 运行时依赖
- hash chain 仅 tamper-evident，非密码学不可抵赖

## Decisions

### D1: 唯一工具面组装入口（H1）

**选择**：新增 `resolveToolSurfaceForRun(opts)` 于 `tool-surface-builder.js`（或等价模块），`agent-run-executor`、`main.js` ai-generate 路径 **MUST** 调用此函数。

**分支**：
- `KNOWME_TOOL_SURFACE=legacy` → 旧 `createToolSurface` 子集（只读文件 + 既有 Feishu draft）
- 默认 `v1` → `buildFullToolSurface` + Registry validate

**理由**：Review H1 — Registry 仅存在于测试/Builder。

**备选**：在 `createToolSurface` 内隐式分支 — 拒绝，职责不清。

### D2: cancelSubRun 接线（H2）

**选择**：`ai-cancel-run` handler：
1. 标记父 Run `CANCELLED`
2. 调用 `orchestration.cancelAllSubRuns(parentRunId, { cancelSubRun })`
3. `cancelSubRun` 内部 abort 子 Run 的 AbortController + `AgentRunExecutor.cancel(runId)`
4. `cancelProcessesForRun` 保持现有联动

**Electron E2E**：mock LLM 触发 delegate → 用户 cancel → 断言子 Run trace 终态。

### D3: start_process 与 sandbox 策略统一（H3）

**选择**：
- `start_process` **禁止** 任意 command 字符串；仅允许：`run_task` 模板 ID 引用 **或** pre-approved process template registry
- 若必须保留 low-level spawn：共用 `agent-sandbox.screenCommand` + `DANGEROUS_PATTERNS` + network gate
- Windows：`shell: false` 默认；若 unavoidable 使用 `cmd.exe /d /s /c` 且 argv 数组化，禁止字符串拼接
- 参数注入负例：`node -e`、`powershell -Command` 嵌套引号 MUST 拒绝

### D4: blockedHosts 先于 approval（M1）

**选择**：域名检查顺序：
1. parse URL → invalid → `invalid_url`
2. **blockedHosts / RFC1918 / link-local** → `scope_denied`（硬拒绝，不可确认）
3. allowlist miss + requireHostConfirm → `approval_required`
4. else → proceed

**内网检测**：除 localhost 外，解析 hostname 为 private IP 或使用 blocked 前缀表（10/172.16/192.168/169.254）。

### D5: IPC test-only seam（M2）

```
Renderer → preload → main IPC (never carries fakeApply)
Main test harness / node --test → inject via module opts or env KNOWME_TEST_SEAM=1
Audit record: { approverId, sessionId, runId, draftId, outcome }
```

生产 IPC payload schema **strip** unknown test keys。

### D6: Draft CAS 状态机（M3）

状态：`pending` → `applying` → `applied` | `rejected` | `failed`

- `approveDraft(id)`：CAS `pending→applying`；失败返回 `not_pending`
- apply 成功 → `applied`；异常 → `failed` + rollback hint
- Windows `rename` EPERM：指数退避 3 次（50/100/200ms）
- 文件锁：单 writer 进程内 mutex + 文件 mtime 校验

### D7: move_path 双向 rollback（M4）

apply 顺序：backup source → backup target → move

失败策略：
- move 前失败：无变更
- move 后 partial：restore source from backup；若 target 已存在则 restore target backup
- 暴露 `rollbackDraft(draftId)` UI + audit outcome=rolled_back

### D8: mkdir 产品决策（M5）

**决策**：**不**统一 draft。

| 条件 | 行为 |
|---|---|
| 路径在活跃内容源内 + 父目录存在 + 目标不存在 | 直建；时间线「已创建目录 `<rel>` · 低风险直建」 |
| 路径在内容源外 / 父不存在 / 目标已存在 | draft → 批准 |

可测：直建用例断言 **0** draft 记录 + timeline title 含路径。

### D9: Runtime store eviction（M6）

| Store | TTL | Max entries | 旧 id 行为 |
|---|---|---|---|
| processRegistry | 24h | 500 | `task_status` → `expired` |
| artifactStore | 7d | 200 | 友好文案 + 重新生成建议 |
| runStates (orchestration) | 1h post-terminal | 100 | `not_found` +「Run 已结束或已清理」 |

启动时 lazy purge；超 cap LRU 淘汰。

### D10: 审计 hash chain（L1）

每条 audit append：`{ ...fields, prevHash, recordHash }` where `recordHash = sha256(prevHash + canonicalJson)`。

写失败：console error + UI dev-only indicator；**不**静默丢审计。

脱敏：`token`、`authorization`、`password`、`secret` 字段 → `[REDACTED]`。

### D11: 路径 symlink/junction（L2）

写/移动前：`lstat` 不 follow；目录创建前 `realpath` 验证父路径在 content root 内；Windows junction 指向 root 外 → `scope_denied`。

### D12: 批准 IPC 单实现（L3）

`tool-approve-draft` 与 `approveFeishuDraft` 合并为 `toolApproveDraft(draftId, meta)`；旧 IPC 名保留 thin wrapper 打 deprecated 日志。

### D13: Tool UX（L4）

- `toolTimelineTitle(tool, args, draft)` → 「写入 preview.txt」「移动 a → b」「飞书文档：标题」
- 审批卡 pending：按钮 `disabled` + spinner
- Rollback 按钮：applied file draft 卡片上「回滚到备份」
- Hub：Playwright 安装步骤链接可点击（文档 URL 或 `shell.openExternal`）

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 唯一入口改动影响面广 | legacy flag + 闭环 eval 回归 |
| CAS 增加 draft apply 延迟 | applying 状态 ≤500ms；UI loading |
| start_process 限制过严 | 文档化 approved templates；run_task 覆盖常见场景 |
| hash chain 非密码学安全 | spec 明确 tamper-evident only |
| Electron E2E flaky | mock 子 Run + 可选 manual UAT |

## Migration Plan

1. **Phase 0**（本 planning）：工件 apply-ready
2. **Phase 1**（HIGH）：H1 Registry 热路径 + H2 cancel + H3 start_process
3. **Phase 2**（MEDIUM）：M1–M6 并发/浏览器/IPC/draft/move/mkdir/eviction
4. **Phase 3**（LOW + UX）：L1–L4 审计/路径/IPC/UX + Hub 点击流
5. 每 Phase：`npm test` + phase gate JSON
6. 全量：制作人验收 → 测试 QA → `/gate-check` → `/story-done`

回滚：不涉及 schema 破坏；`KNOWME_TOOL_SURFACE=legacy` 仍可回退工具投影。

## Open Questions

（无阻塞 apply 项）

- Hub Playwright 安装链接指向 npm 包还是文档站 — Phase 3 文案决定
- RFC1918 检测是否包含 IPv6 ULA — 默认 yes，单测覆盖
