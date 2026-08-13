## Context

`workbench.js` 约 12K 行，IIFE 内嵌大量 `render*` / `setSurface`。已有 `src/workbench/{escape,labels,provenance,run-phase}.js`。参见 `openspec/specs/entry-modularization/spec.md`。

## Goals / Non-Goals

**Goals:**
- 抽出 surface 路由与首批事件绑定，降低单文件热区
- 保持对外行为与 DOM 契约不变
- 文档化后续拆分顺序，供搭车 Story 使用

**Non-Goals:**
- 本 Story 不拆完 runner/studio/daemon 全量
- 不迁 TS / 不引入模块打包器
- 不改产品交互文案

## Decisions

1. **模块形态**：浏览器侧继续用相对路径 `require`/`script` 现有加载方式；与已存在 `src/workbench/*.js` 一致（CommonJS，由 workspace preload/主加载链引入）。
2. **第一刀范围**：
   - `surface-router.js`：`setSurface`、surface 枚举、与 `renderTaskHome/Shelf/Studio/...` 的分发表
   - `dom-events.js`（或按实际命名）：货架/顶栏等高频一次性绑定，接收 deps（state getters + render callbacks）
3. **依赖注入**：抽离函数接收显式 deps，避免隐式闭包难测。
4. **后续顺序**：shelf/runner → studio → daemon → automation → workspace-agent 搭车拆。

## Risks / Trade-offs

- 闭包断裂导致「点了没反应」→ 开发自测 + 现有 UI 契约测试
- 过度拆分增加跳转成本 → 每刀限 1～2 个内聚模块
