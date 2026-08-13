## 1. 工具面投影预算与优先级

- [x] 1.1 `agent-tools.normalizeExtraDefinitions` 支持预算参数与优先级排序，必需工具 / 连接器工具优先
- [x] 1.2 提高默认预算以容纳完整 v1 内建工具面 + 已启用连接器工具
- [x] 1.3 超预算时输出 warn 日志（含被裁工具名与预算），不静默丢弃
- [x] 1.4 `tool-surface-builder` / `tool-contract-registry` 投影链路传递 requiredTools 优先级

## 2. 失败可观测

- [x] 2.1 `workspace-agent.js`：v2 失败且无正文时展示 main 返回的错误文案，兜底文案仅在无原因时使用
- [x] 2.2 `main.js`：requiredTools 不可用等前置失败路径收敛 Run 终态（failed + 原因）

## 3. 回归与证据

- [x] 3.1 单测：extras 超预算时 requiredTools / 连接器工具必须保留；裁剪产生 warn
- [x] 3.2 `npm test` + `npm run lint`
- [x] 3.3 Electron 真机冒烟：点「查文档/知识库」拿到真实候选分区，控制台无业务错误
- [x] 3.4 写 `evidence/dev-self-test.md` 与冒烟报告
