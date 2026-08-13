## Context

管线服务安装在 `settings.workbenchInstall.path`（如 `D:\workflows\workbench`），workflow JSON 在 `.cursor/workflows/`。Daemon catalog 返回 `path`（如 `examples/doc-to-plan.mvp.json`）。KnowMe 本地 `.cursor/workflows` 仅含少量仓库内流程，不能作为 Daemon 步骤投影源。

## Goals / Non-Goals

- Goals: 时间 slug；创建前预检；投影读 Daemon 安装目录；失败事实一致
- Non-Goals: 改造上游 Daemon OpenAPI；本地 Local Team 路径

## Decisions

1. **Slug**：`{workflow}-{YYYYMMDD-HHmmss}-{rand}`，在 `createAndRun` 缺省或非法时生成
2. **预检**：`workflowNeedsCli` 为真时，要求 `cursorApiKeyReady` 与 `executorReady`（health.executor_seen_at / hostname）
3. **投影源**：`resolveDaemonContentRepo(settings)` → 安装目录；`projectDaemonTask` 只用该源
4. **失败对齐**：`terminalKind=failure` 或 failed 状态优先于 done 文案

## Risks

- 未配置安装目录时仍 degraded → 文案引导去设置配置管线安装路径
