## Why

P4 补齐 Knowledge Fabric 治理能力：SSOT 去重、断锚/stale 检测、联合体检与冲突调和，让用户在知识中心可定位问题并生成可审核提案。

目标用户：维护多库织网、需要体检与冲突治理的知识工作台用户。

验收标准：
1. ingest/织网前 SSOT 检测（默认 mark，可选 block）并生成更新/alias 提案。
2. 悬空 anchor 与 stale 标记可检测，重织队列可按需处理。
3. 联合体检聚合 Wiki/OKF lint、冲突、重复标题与各库健康分。
4. 知识中心「治理」Tab：运行体检 → 问题列表 → 行动项闭环，控制台 0 报错。

## What Changes

- `src/lib/fabric-governance.js`：SSOT、断锚、stale、联合体检、治理提案、重织队列
- 挂钩 `fabric-weave.js`（织网 SSOT + syncHash）、`fabric-retrieval.js`（冲突回流）、`knowledge-os-ingest`（入库 SSOT）
- IPC/preload：`fabric-governance-*`、`fabric-reweave-run`
- 知识中心 UI：治理 Tab + 健康分仪表盘 + 行动按钮

## Non-goals

- embedding 级 SSOT（无模型时词面/标题兜底已覆盖 MVP）
- 全自动冲突合并（须人工确认提案）
- qmd Windows 打包 spike
- 章节级锚点、力导向图谱可视化

## Capabilities

### New Capabilities

- `fabric-governance`: SSOT、断锚/stale、联合体检、冲突治理回流

### Modified Capabilities

- `knowledge-fabric-runtime`: 织网/检索/ingest 集成治理钩子
- `workspace`: 知识中心新增治理 Tab
