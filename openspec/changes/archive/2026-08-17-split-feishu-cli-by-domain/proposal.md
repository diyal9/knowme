## Why

`src/lib/connectors/feishu-cli.ts` 已达 2498 行，超出架构 1200 硬顶并在 `architecture-lib-oversize.json` 白名单中。单文件混合 spawn/鉴权/会议/IM/日历/云盘/写操作等多域逻辑，维护与 review 成本高。

## What Changes

- 按变化原因（lark-cli 子命令域）拆至 `src/lib/connectors/feishu-cli/` 子模块。
- 原 `feishu-cli.ts` 改为薄组合根，`module.exports` 键与拆前完全一致。
- 从 `scripts/architecture-lib-oversize.json` 删除 `feishu-cli.ts` 条目。
- 各新文件 ≤1200 行（目标 ≤800）。

## 非目标

- 不改产品行为、IPC、Daemon、工具契约。
- 不重写 lark-cli 调用逻辑或错误文案。

## Capabilities

### New Capabilities

- （无产品能力变更；纯 lib 重构）

## Impact

- `src/lib/connectors/feishu-cli.ts` 及新建 `feishu-cli/*`
- `scripts/architecture-lib-oversize.json`
- 测试继续 `require('./feishu-cli')` 不变
