## Why

上帝文件与双份规则让工作台无法作为正式产品演进：改一处组件无法同步到 lib / domain / 旧测试黄金页。便签遗产仍占窗口、IPC 与叙事，与「知识工作台」定位冲突。正式版前必须统一结构并退役便签产品面。

## What Changes

- 按 `src/main/`、`src/preload/`、`src/app/`、`src/domain/`、`src/renderer/features/*` 切开运行时结构；`main.js` 降为组合根。
- **BREAKING（产品面）**：退役独立便签窗口、便签总览 `list` 窗、便签备份与托盘「关便签」路径；助理 `@` 只引用内容源文件。
- Studio 规则只保留一处（domain TS），去掉 `globalThis` 包装双份。
- 渲染层按 feature 包拆 store；设置等次要窗禁止空壳充数。
- 先迁测试再删除 `tests/fixtures/legacy-pages/` 与便签相关 L0。
- 功能冻结：不改 IA、不加能力、不改 Daemon 语义。

## Capabilities

### New Capabilities

- `knowme-runtime-layout`: 运行时目录与 feature 包边界；主进程组合根；单一事实源。
- `notes-product-retired`: 便签作为独立产品面不可达。

### Modified Capabilities

- `note-close-resume`: 需求撤销（产品面删除）。
- `note-minimize-to-tray`: 需求撤销（产品面删除）。
- `list-home`: 总览窗随便签退役。
- `workspace`: 不再托管便签窗口；主壳为工作台 + 助理。
- `ai-assistant`: `@` 文件目录来自内容源，不来自便签库。

## Impact

- `src/main.js`、`src/preload.js`、`src/ipc/notes*`、`src/lib/note*`、`src/renderer/note|list`、Vite 入口、大量 `tests/note-*` 与读黄金页的 L0。
- 数据目录仍为 `%APPDATA%\KnowMe\`；不迁移、不删除用户已有便签文件（仅 UI/IPC 退役）。

## 目标用户

KnowMe 桌面用户（工作台主路径清晰、无便签产品干扰）；后续开发者（可按 feature 改代码而不撞几千行文件）。

## 验收标准

- 启动后无「新建便签 / 便签总览」入口；工作台 rail / 货架 / 助理 / 文件树可用。
- `main.js` 为薄入口；store 按 feature 切片；Studio 无 `globalThis` 双份。
- `npm test`、`npm run lint`、`test:renderer`、`typecheck:renderer` 通过。
- 现行 spec/qa 模板不再把 KnowMe 写成便签产品。

## 非目标（Non-goals）

- 不改 Daemon API、不改内容源语义。
- 不删 `openspec/changes/archive/`。
- 不把 `src/lib` 一次性手写重写成新算法（只迁结构 / 去 DOM / 去双份）。
- 架构 lint 体量门禁留给 change `knowme-architecture-guardrails`。
