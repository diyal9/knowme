## Why

`docs/daemon/` 是上游 workflow-web API 的手工同步副本，版本漂移只能靠人眼发现。需要脚本/门禁比对版本号，避免客户端按过期协议实现。

## What Changes

- 新增 `scripts/check-daemon-docs-sync.js`：读取本地 `docs/daemon/API.md` / `README.md` 版本字段；若配置了上游路径则比对，否则做本地自洽校验
- 接入 `npm run daemon:docs-check` 与 `harness doctor`（advisory，上游缺失不硬失败）
- 更新 `docs/daemon/README.md` 说明同步流程与环境变量

## Capabilities

### New Capabilities

（无 — 工具/文档治理，`skip_specs: true`）

### Modified Capabilities

（无）

## Impact

- 脚本、`package.json`、`.cursor/scripts/harness.js`、`docs/daemon/README.md`
- 上游默认路径：`DAEMON_API_UPSTREAM` 或 README 中声明的路径；本机可缺省
