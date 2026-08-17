## Why

工作台首屏几乎 eager 导入全部表面，助手默认路由还扇出 Hub/知识 IPC，隐藏的 Files 侧栏仍拉文件树。GPU 已改善后，加载与重渲仍偏重。

## What Changes

- 非默认路由表面 `React.lazy`（助手保持 eager）
- `filesOpen` 前不挂载 FilesPane
- 助手 chrome 不再拉 Hub；知识延后加载
- TaskHome 去掉 `setHubTab` 触发的重复 Hub IPC
- AppShell 收窄对 `run`/`expertRoom` 的订阅

## Capabilities

### New Capabilities

- `workspace-first-paint`: 工作台首屏加载与挂载策略

### Modified Capabilities

- （无）

## Impact

- `AppShell.tsx`、`store-assistant.ts`、`TaskHomeSurface.tsx`
- 首进助手更快；首次打开 Settings/Hub/知识可能有极短 Suspense
