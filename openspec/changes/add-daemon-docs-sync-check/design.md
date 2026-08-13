## Context

`docs/daemon/README.md` 声明上游路径与同步版本；本机上游可能不存在。检查须 soft-fail。

## Goals / Non-Goals

**Goals:**
- 解析本地 API.md / README 版本字段并自洽
- 上游存在时比对文件哈希或版本字符串
- 接入 npm script + harness doctor（advisory）

**Non-Goals:**
- 不自动覆盖复制上游文件
- 不在 `npm test` 硬失败（除非显式 `DAEMON_DOCS_STRICT=1`）

## Decisions

1. 版本源：优先 API.md 文档版本表；与 README「当前同步版本」交叉校验
2. 上游路径：`process.env.DAEMON_API_UPSTREAM` > README 表格路径 > 跳过比对
3. 输出：`--json` 便于 harness；退出码 0=ok/advisory，2=strict 失败

## Risks / Trade-offs

- 上游路径因人而异 → env 覆盖
- 仅比版本号可能漏内容差 → 可选内容哈希（有上游时）
