# Proposal: split-entry-ipc-workbench

## Why

`main.js` / `workbench.js` 已成万行级编排文件。领域逻辑已在 `lib/`，但 IPC 注册与工作台 UI 控制器仍堆在入口。按域拆 JS、不换语言，降低变更风险。

## What Changes

- **保留 `lib/`** 为领域逻辑；不新建平行 `logic/`
- 新增 **`src/ipc/`**：首批迁出 `open-external`、`settings`（get/save/remote-config）、`sources-*`
- 新增 **`src/workbench/`**：浏览器侧纯标签/provenance 助手，供 `workbench.js` 调用
- 新增 **`src/ui/`**：约定跨窗 UI 积木落点（本 change 仅建目录约定 + 可指向 ui-kit）
- **`src/lib/utils/`**：约定极瘦跨域工具落点（本 change 可空，禁止垃圾场）

## Out of Scope

- 不全量拆完 main/workbench
- 不迁 TypeScript / Rust
- 不批量 rename 现有 `lib/*` 进子目录（后续 Story）

## Success

- main 通过 `register*Ipc(deps)` 挂载首批通道，行为不变
- `npm test` / `npm run lint` 通过
- 文档约定写入 design，后续 Story 可继续 strangler
