# harden-workbench-tool-surface-runtime 复盘

- 日期：2026-08-06
- 结论：开发自测、制作人验收、正式 QA 与最终硬门禁均通过
- 范围：工作台工具面生产热路径、安全策略、审批一致性、可观测性与反模式验证

## Registry 生产热路径

- Agent Run 的工具面必须由唯一 resolver 组装，并从 Tool Registry 投影契约；仅注册定义而未接入 `ai-generate` / executor 热路径不构成完成。
- execute wrapper 应在 handler 前完成 schema/contract 校验，并统一 envelope、`auditId` 与副作用审计，避免 ad-hoc 工具绕过治理。
- legacy 回退应是明确、受限的工具子集，不能无意暴露 v1 写入、进程或编排工具。

## Cancel 与资源清理

- 父 Run 取消必须同时传播到子 Run、后台进程与预算循环；只 abort 顶层 controller 会留下继续输出或继续计费的子任务。
- `cancelSubRun` 需要从 run executor 真实接线到 orchestration，并在取消后再次 sweep registry，确保 running 子 Run 在 3 秒预算内归零。
- 终态条目采用 TTL + 容量上限清理；查询旧 id 返回可读 `expired/not_found`，不能抛异常或伪装为 running。

## Process policy

- `start_process` 不得接受任意 shell 字符串绕过 sandbox；优先注册模板或经同一 `screenCommand`、危险模式、联网与权限策略筛选的 argv。
- Windows 默认 `shell:false`，尤其要覆盖 PowerShell、`cmd /c`、`node -e`、嵌套引号和环境变量注入。
- process registry 的 TTL/LRU 能控制长期内存增长，但后续应评估超高并发下跳过 running/starting 条目的 LRU 策略。

## CAS 与审批

- draft 使用 `pending → applying → applied|rejected|failed` 状态机；批准入口必须通过 CAS 获得 apply 权，保证快速连点和跨窗口并发下 at-most-once。
- Renderer 传入的 `fakeApply` 等测试键必须剥离；测试替身只能由主进程 test-only seam 开启，防止生产 IPC 注入。
- 统一 `toolApproveDraft` 为唯一实现，legacy IPC 仅做代理；按钮在 applying 期间 disabled + loading，并对已处理状态给出明确反馈。
- Windows 原子 rename 的 EPERM 需要有限退避；失败进入可恢复的 failed 状态，不能误标 applied。

## Audit

- 副作用与批准事件写 append-only audit，并包含 run/session/approver/target 摘要。
- `prevHash` + `recordHash` 提供 tamper-evident 链，但不得宣称不可抵赖；当前仍可考虑补充运行时 `verifyAuditChain` 工具。
- token、password、authorization、secret 在 audit 与 console 中必须统一脱敏；audit 写失败必须可见，不能静默丢失。

## Path security 与回滚

- lexical `..` 检查不足以防 symlink/junction 逃逸；写、移动、删除和 mkdir 前应结合 `lstat`、父路径 `realpath` 与 root containment。
- Windows junction 指向内容源外必须返回 `scope_denied`；目标 symlink 不得被 follow 到 root 外。
- `move_path` 半失败时需同时恢复 source 与原 target；回滚本身也要审计并在 UI 提供入口。
- 内容源内、父目录存在且目标不存在的 mkdir 可作为低风险直建，但时间线必须明确路径与「低风险直建」；其他情况走 draft。

## 反模式测试经验

- 正向 happy path 不足以证明安全；本 Story 用快速双击、跨窗口批准、拒绝零副作用、取消后泄漏、PowerShell/Node 注入、内网导航、token 日志、move 半失败、store 超限与旧 id 查询覆盖失败模式。
- blocked host 必须先于 allowlist/首次确认判断，否则会把 localhost/RFC1918 错误降级成可绕过审批。
- mock Electron smoke 可验证模块接线与状态收敛，但不等同真机 UI；飞书真 apply、Playwright MCP live 与 live Agent 审批在缺凭据时应如实 SKIP。
- 测试证据应同时断言“发生了什么”和“没有发生什么”，例如第二次批准无写入、取消后无新增 tool event、拒绝后磁盘不变。

## 后续 ADVISORY

- 极端超过 process registry cap 时，LRU 可能淘汰最旧 running 条目。
- audit hash chain 暂无运行时验证 API。
- Electron smoke 主要为逻辑 mock，live UI 路径仍依赖真实环境。
- 飞书审批卡可进一步显式展示 connector id/type。
- chat-only minimal 路径未经过完整 resolver；当前无工具时合理，后续扩展时需防止旁路。

本复盘仅写入 working memory；未执行 `/kb-ingest`，是否升格为团队 OKF 需用户另行确认。
