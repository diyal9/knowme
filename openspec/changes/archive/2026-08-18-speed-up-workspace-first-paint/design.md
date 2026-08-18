## Context

默认路由 assistant；AppShell 静态导入几乎所有表面；Files 隐藏仍 mount；loadAssistantChrome 拉 Hub+知识。

## Goals / Non-Goals

- Goals：减首包与首屏 IPC；行为对外不变。
- Non-Goals：不改流式 Markdown 架构；不改 GPU 策略；不拆 CSS 包（避免 FOUC）。

## Decisions

1. lazy：Settings / Knowledge / Hub / Shelf / TaskHome / Run / Expert / Workflow / LinkPreview；Assistant 保持同步。
2. FilesPane 仅 `filesOpen` 时挂载。
3. `loadAssistantChrome` 去掉 `loadHubCapabilities`；`loadKnowledge` 用 `setTimeout(0)` 延后。
4. TaskHome：`setState({ hubTab: 'expert' })` + 单次 `loadHub`，不调用 `setHubTab`。
5. AppShell 只订 `!!expertRoom` 与 `run?.lane`。

## Risks

- Composer 知识列表首次可能空一拍 → 延后 load 仍会补齐。
- lazy 首次点进表面有短暂空白 → `Suspense fallback={null}` 与现有 Manage/Studio 一致。
