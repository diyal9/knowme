## Context

渲染层已切 React，但主进程仍是三千行 `main.js`，preload 平铺，Zustand 单 store，Studio 通过 `globalThis` 包 CJS 模型。便签窗/IPC/测试仍在。本 change 只迁结构并退役便签产品面。

## Goals / Non-Goals

**Goals:** 薄组合根；feature store 切片；Studio 单一事实源；删除便签与 list 窗；L0 不再读 `legacy-pages`。

**Non-Goals:** Daemon 协议；把 `src/lib` 全部重写算法；架构行数 lint（下一 change）。

## Decisions

1. `package.json` `main` 仍指向 `src/main.js`。`src/lib` 为 TypeScript，由 `scripts/register-ts.js`（typescript.transpileModule）在 Electron 与 `npm test` 中加载；`require('./foo')` / `require('./foo.js')` 解析到 `foo.ts`。
2. 便签 IPC 整模块删除，不留 noop 假装还在。
3. Vite 去掉 `note` / `list` 入口。
4. `src/lib/workbench-studio-model.ts` 仅被 domain 以 ESM 可打包方式引用一次（`module.exports` + Vite CJS interop，禁止 `globalThis`）。
5. 设置窗补齐模型/内容源/连接器三个可达区块（调用现有 preload API），不做视觉重设计。

## Electron 边界

```text
src/main.js (boot)
  -> src/main/windows.js, tray.js, ipc-register.js
  -> src/ipc/* (无 notes)
preload 拆文件后 expose window.api
renderer features -> window.api only
```

## 删 / 留 / 迁

| 删 | 留 | 迁 |
|----|----|----|
| note/list 窗口与 renderer 入口 | workspace/settings/memory/log-viewer | 窗口工厂 → `src/main/` |
| `ipc/notes*`、`lib/note*`、`notes-backup` | `ipc/sources*`、knowledge、workbench | store 字段 → feature slices |
| `tests/note-*`、`legacy-pages` | `tests` 测 lib/ipc 现行代码 | 黄金页断言 → domain/React |
| 现行 spec 便签需求 | archive 历史 change | wiki 概览去「桌面便签」 |

## Risks

| Risk | Mitigation |
|------|------------|
| 大量 L0 读 html 失败 | 先改测试再删文件 |
| 助理 @ 空 | `agentFileCatalog` 已接 sources-tree |
| main 拆分漏 IPC | 保持 `ipc/index.js` 为唯一 register 表，从表删除 notes |
