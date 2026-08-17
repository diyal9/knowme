# KnowMe 技术架构

正式文档。Cursor Rule 与 `npm run lint` 中的 `check-architecture.js` 按本文执法。

## 产品

知我是本地优先的 AI 知识工作台 / 工作伙伴。主界面是工作台与助理。已退役的独立笔记窗 / 总览 / 备份产品面不得恢复。

数据：`%APPDATA%\KnowMe\`；正文在用户绑定的本地文件夹或 GitLab。

## 分层

```text
src/renderer/features/*   UI + 本面 store 切片（禁止 ipcRenderer）
src/renderer/app          壳：Rail、布局、组合 store
src/domain                纯规则，禁止 window/document/Electron
src/shared                IPC DTO 唯一源（api.ts）
src/preload.js            薄 boot → src/preload/*.ts
src/main.js               薄 boot → src/main/index.ts（ctx + create：boot / agent-runtime / icons / shell / knowledge / workbench / process-guards → ipc-deps.bindCoreIpc → registerCoreIpc pick 域；禁止 vm concat、part-*、scope 单例、attach 入口）
src/ipc                   主进程 IPC 处理（TypeScript）
src/lib                   无 DOM 应用服务（TypeScript；Electron/测试经 register-ts.js 加载）
```

## 单一事实源

一条产品规则只允许一个模块导出。禁止 `lib` 一份 + `domain` 再包 `globalThis` + fixtures 再留一份。

## Feature 包

每个用户可感知面（助理、货架、Run、Studio、设置、知识网、专家库）独立目录。`AppShell` 只做布局与路由。跨 feature 禁止互改对方私有状态。

## 模块边界（优先于行数）

优先级：**单一职责（一个变化原因）> 模块化 / 组件化 > 行数。**

拆文件的理由是出现 **第二套变化原因**（另一个域、另一类调用方、另一份测试面）。一块内聚能力（例如沙箱执行、单一协议 reducer）到七八百行仍然可以是好模块。模块化、组件化是职责已经分叉之后的手段，不是把文件切短的目标。

禁止为过行数而拆：共享神对象 `ctx`、把 class 方法外挂到 `prototype`、半截复制 `require` 头。禁止用 vm concat 规避预算。

## 文件预算

| 级别 | 行数（`src/**/*.{ts,tsx}`，不含 `dist/`） | lint |
|------|------------------------------------------|------|
| 告警 | 超过 1200 | `WARN`，不失败。问：是否仍是单一职责。 |
| 硬顶 | 超过 2000 | `ERROR`。视为过于庞大。 |

存量已超过硬顶的路径列在 `scripts/architecture-lib-oversize.json`：只许缩小、不许再涨、不许新增键。降到 ≤2000 后删除该键。

`src/lib` 不得再出现 `.js`。主进程入口仍是 `src/main.js`（CJS），启动时先 `require('../scripts/register-ts')`。`src/lib` / `src/main` / `src/ipc` 禁止 `@ts-nocheck`。

## 源码注释

新增或实质性修改 `src/` 时必须有必要注释（文件头、重要导出函数、非自明常量），禁止复述代码。约定见 `.cursor/rules/source-comments.mdc`。

## 禁止

- 新增 `src/*.html` 页面控制器（`attention-toast.html` 除外）
- UMD / `window.Xxx =` 作为模块导出
- React 使用 `ipcRenderer`
- 测试 `readFileSync` `tests/fixtures/legacy-pages`
- 现行文案偏离知识工作台 / 工作伙伴定位
- 无 OpenSpec 新增表面

## IPC

先改 `src/shared/api.ts`，preload 与 main 使用同一方法名。
