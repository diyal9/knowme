## Context

See proposal.md — Why。当前 `workbench-daemon-client` 的失败分支读 `body.code || body.error_code`，而 Daemon v1.0.0 稳定字段在 `body.detail.code`；`errorMessage` 已能读 `detail.message`，故用户偶见中文提示但 `code` 仍为 `http_error`。

Electron 边界：协议解析在主进程可加载的 `src/lib/*` 纯模块中完成；渲染侧只消费已归一化的 `{ ok, code, error, status }`，不直接解析 HTTP body。

## Goals / Non-Goals

**Goals:**

- 单一错误解析模块，供 daemon client 与 auth login 共用
- 以 `detail.code` 为分支主键；兼容旧格式
- 仓库内协议文档与上游版本号可核对

**Non-Goals:**

- 不为每个错误码做独立 UI 路由表（除既有 auth 引导）
- 不引入跨进程协议版本协商变更

## Decisions

1. **新增 `workbench-daemon-errors.js`**  
   - 导出：`parseDaemonError(body, status, fallbackMessage)`、`DEFAULT_MESSAGES`、`isAuthErrorCode(code)`  
   - 解析优先级：`detail.code` → 顶层 `code`/`error_code` → HTTP/启发式兜底  
   - 文案优先级：`detail.message` → 顶层 `message` → 目录默认文案 → fallback  
   - 替代方案：仅在 client 内联修复 —— 拒绝，因 auth 模块重复同一逻辑。

2. **鉴权映射**  
   - `auth_required`、`unauthorized` → 归一为客户端 `auth_required`（兼容 `handleDaemonAuthFailure`）  
   - `task_forbidden` / `tenant_forbidden` / `forbidden` → 保留原码，**不**走授权设置引导  
   - 无码时仍可用现有 `isAuthFailure(status, message)` 启发式（兼容旧服务端）

3. **协议文档落点**  
   - `docs/daemon/API.md`：上游全文同步  
   - `docs/daemon/README.md`：同步说明、KnowMe 调用端点清单、与上游差异（`launch-context`）  
   - 不把全文塞进 OpenSpec spec（spec 只约束行为）

4. **本地客户端码**（`timeout`/`offline`/`invalid_slug` 等）保持不变，不与上游码混写进 DEFAULT_MESSAGES 的「服务端目录」表；可另列 CLIENT_CODES 注释。

## Risks / Trade-offs

- [旧 UI 依赖 `http_error`] → 透传具体码后分支变细；保留 `error` 字符串展示，现有 toast 仍可用  
- [上游再增码] → 未知码原样透传 + message 展示，目录缺省不阻塞  
- [文档双源漂移] → README 标注源路径与版本；变更时人工再同步

## Migration Plan

1. 合入解析模块与测试  
2. 同步文档  
3. 无需数据迁移；回滚即还原 client/auth 与删除 docs/daemon 副本

## Open Questions

无（`launch-context` 标注为客户端扩展即可）。
