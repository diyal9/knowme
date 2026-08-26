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

## Context Engine

主助手会话进入模型的系统上下文统一经过 `src/lib/context-engine/`。Renderer 只提交原始用户输入、场景标识和结构化任务事实；Main 负责解析可信 persona、执行权限与候选 ContextBlock。标题生成等无会话 one-shot 任务保持独立、最小化的固定契约。

装配顺序为稳定核心、当前场景、当前 persona、必需事实、相关可选块、对话历史、原始用户输入。Block 必须声明来源、权限层级、信任级别、关键性、预算和缓存策略；检索、记忆与 Renderer 投影始终按不可信数据处理，并以 JSON 数据封装进入 user role，禁止进入 system role。专家规划和成果讨论使用独立 persona，但执行策略固定为 `no-tools`，运行时必须投影空工具面。

内置提示词按 locale 存放在 `src/lib/context-engine/prompts/`，通过稳定 block ID 读取；未提供对应语言时回退 `zh-CN`。旧提示词 API 只作为兼容 facade，不得成为新增规则的事实源。

每轮装配输出不含原文的 ContextManifest，用于观测身份、阶段、权限、预算、入选/省略块和冲突。安全、身份和权限不得由向量相似度决定；向量只可作为 optional block 的补充排序信号，失败时必须回退确定性与词面选择。

远程 Embedding 由 `src/lib/embedding-runtime.ts` 提供 OpenAI-compatible 插件实现，Context Engine 在 `semantic.ts` 中负责按条目/字节双预算缓存、取消隔离 single-flight、短超时、熔断和 shadow/active 策略。同步 assembler 不访问网络，只接收预计算的 `vectorScores` 与匿名 telemetry。默认 `contextSemanticMode=off`，候选不超过 topK 时不得请求；敏感 block 未获用户授权时不得发送正文。

知识检索 `semanticRerank` 与 Context Engine `contextSemanticMode` 是两个独立能力开关。Embedding Endpoint/API Key 留空时继承主模型设置；填写不同 Host 时必须使用独立密钥，禁止把主模型密钥静默转发到第三方地址。独立密钥必须经 `safeStorage` 加密，日志和 ContextManifest 不得出现 endpoint、模型名、query、正文或密钥。

core、scene、tool contract 属于不可截断关键控制面。assembler 与最终对话预算器执行双层预算检查，无法同时完整保留关键规则和当前用户输入时必须 fail-closed。`context-engine/metrics.ts` 聚合延迟、降级、缓存、token 节省和安全不变量，黄金评测固定身份、权限、注入与选择行为。

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
