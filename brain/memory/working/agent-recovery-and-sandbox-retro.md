# Retro: agent-recovery-and-sandbox

- 日期：2026-07-30
- 归档：`openspec/changes/archive/2026-07-30-agent-recovery-and-sandbox/`

## 做了什么

给 Agent 工具执行补齐「失败后恢复」能力，让产品具备 Reason→Act→Observe→Reflect：

- `src/lib/agent-recovery.js`：错误分类（网络/超时/权限/单条妙记权限/参数/未注册工具/缺资源/空结果/取消/未知）、有限指数退避重试、替代工具建议、参数修正、反思提示生成。
- `src/lib/agent-sandbox.js`：`run_python` / `run_shell` 受限脚本工具，Run 独占临时目录、超时与输出上限、破坏性/外联命令 spawn 前拦截。
- `src/main.js`：`ai-generate` 循环内嵌入单调用重试 + 全轮失败反思轮（受 `MAX_RECOVERY_ROUNDS` 与重复调用收敛双重约束）；`mergeExtraTools` 合并文件/沙箱工具。

## 门禁证据

- npm test 534/534、lint ok、harness gate `ok:true`（软项 0）
- Electron 真机重启：主进程启动无 uncaught error
- 反模式核查见归档内 `evidence/test-report.md`

## 经验沉淀（可复用）

1. **单条妙记权限 ≠ 缺应用授权**：`No read permission for minute <token>` 应归类为「单条 ACL」，引导 `feishu.draft_minute_permission`，禁止用同一 token 机械重读。
2. **只有 network/timeout 自动重试**；权限/参数类必须走反思或如实反馈，不重试。
3. **反思轮必须双重收敛**：预算上限 + 命中调用缓存即结束，避免无限循环。
4. **沙箱要在 spawn 前拦截**危险/外联命令，而非执行后判断。

> 复发 ≥3 次可考虑 `/evolve` 升 Skill；本条已具备候选价值（错误恢复策略）。
