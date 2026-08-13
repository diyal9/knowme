## 1. 顶栏结构

- [x] 1.1 移除 `#wbRunStepper` 及相关 CSS；压缩 `.wb-run-topbar` 贴顶
- [x] 1.2 顶栏右侧增加 `#wbRunBack`（chevron + 返回），绑定 `backToRunList`
- [x] 1.3 清理 `setRunStage` / `elRunStepper` 步进高亮逻辑

## 2. 契约与证据

- [x] 2.1 更新 `tests/workbench-templates.test.js`：禁止 stepper、要求 `#wbRunBack` 与 `#wbRunOutcome`
- [x] 2.2 编写 `evidence/dev-self-test.md`；跑 `npm test` / `npm run lint`
