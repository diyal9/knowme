## Why

渲染层与主进程分层已经落地。本 change 第一波已按域拆出刚过 400 的模块。**剩余「全部锯到 ≤400」已作废**，改由 `cohesion-first-file-budget`（400 告警 / 1200 硬顶，按变化原因拆）。

## What Changes

- 按域（agent run、capability、workbench、connectors、knowledge）把白名单文件切成 ≤400 行模块。
- 对外 `require('./旧文件')` 路径保持兼容：原文件改为组合根或薄 re-export。
- 切完且 ≤400 的路径从 `scripts/architecture-lib-oversize.json` **删除**；未切完的只许缩小上限。
- 不改产品行为、IPC 契约、Daemon 语义。

## 目标用户

后续改 KnowMe 主进程服务的开发者（能按域打开文件而不是翻 1000+ 行）。

## 验收标准

- 本 change 触及的文件：新文件均 ≤400 行；从白名单删除的路径实测 ≤400。
- 仍超限的路径：白名单行数 ≤ 拆前，且不许新增白名单条目。
- `npm test` / `npm run lint` / `npm run typecheck:renderer` 绿。

## 非目标（Non-goals）

- 不重写算法、不改 Agent/管线语义。
- 不把 `src/lib` 一次性全部拆完若本迭代时间不够——允许按域分波，但每波必须从白名单删除已达标文件。
- 不改渲染层 feature 包、不加新表面。

## Capabilities

### New Capabilities

- `lib-god-file-split`: 按域拆 `src/lib` 上帝文件并从架构白名单删除达标路径。

### Modified Capabilities

- （无产品需求变更；文件预算仍由既有架构门禁执法）

## Impact

- `src/lib/**`、`scripts/architecture-lib-oversize.json`
- 调用方继续 require 原路径；测试按现行契约跑
