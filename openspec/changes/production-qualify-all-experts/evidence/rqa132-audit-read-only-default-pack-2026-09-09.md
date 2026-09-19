# RQA132：生产能力审计默认保持只读

日期：2026-09-09  
范围：`scripts/audit-production-capabilities.js` 的运行时初始化与显式 `--apply` 边界。

## 发现

审计器初始化能力包运行时时无条件调用 `ensureDefaultPacks()`。该调用可能安装默认能力包，导致不带 `--apply` 的诊断命令改变用户能力数据，破坏“先审计、再显式应用”的安全语义。

## 修正

- `createRuntime` 新增显式 `ensureDefaults` 选项，默认 `false`。
- 只有审计命令带 `--apply` 时才启用默认包安装路径。
- 普通审计仍会加载目录、安装状态、专家快照和条件路线，但不会因为读取而写入默认能力包。

## 验证

- 新增只读回归：临时用户目录初始化审计运行时后，不生成 `capabilities/install-store.json`。
- `tests/audit-production-capabilities.test.js`：`13/13` 通过。
- `npm run check` 需在本轮修正后重新通过，作为最终门禁证据。

## 边界

这项修正保护审计和用户数据边界，不改变正式应用启动或显式 `--apply` 的能力包迁移行为，也不改变真实 Provider、连接器执行和独立专业评审门禁。
