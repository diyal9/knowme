## Why

KnowMe 产品知识库需要从「平级多库」升级为 **Hub-and-Spoke 知识织网**：根 Fabric 负责结构、路由与根优先检索，外挂库通过织网锚点接入。用户需能直观看到知识被组织成网，并体验根优先检索的价值。

目标用户：使用 KnowMe 作为第二大脑/知识工作台的个人与小型团队。

验收标准：
1. 用户能体验结构整理（Fabric 图谱 + 织网提案）与检索命中（检索台 + 来源/authority/冲突提示）。
2. 知识中心 UI 友好：织网/检索/空状态有可行动入口，窄屏可用，控制台无报错。

## What Changes

- KB Registry 元数据（scope/authority/retrievalTier/collectionId 等）
- 根 Fabric：`fabric/graph.json` + `fabric/routing.json`
- 织网管线 + Steward 式提案审核
- 根优先检索（路由短路/强制召回/广扇出 + RRF + 冲突裁决）
- qmd 可插拔引擎（默认 fallback 词面混合检索）
- Agent tools：`fabric_search` / `kb_query` / `kb_get`，`search_knowledge` Fabric 感知
- IPC/preload 补齐：`fabric-*`、`kb-mount`、export/import
- 知识中心 UI：织网 / 检索 Tab

## Non-goals

- 章节/chunk 级锚点（MVP 文件级）
- qmd 原生模块 Windows/Electron 打包（需 `KNOWME_QMD=1` spike，默认 fallback）
- P4 治理深度（断锚体检面板、SSOT 阻断 ingest）
- 替换 `brain/` 开发 llmwiki

## Capabilities

### New Capabilities

- `knowledge-fabric-runtime`: 根 Fabric 三层、织网、根优先检索、Agent/IPC 集成

### Modified Capabilities

- `workspace`: 知识中心新增织网/检索页面
