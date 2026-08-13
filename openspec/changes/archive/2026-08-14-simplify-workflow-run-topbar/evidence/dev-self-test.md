# Dev self-test — simplify-workflow-run-topbar

## 改动摘要

- 移除运行顶栏装饰步进 `#wbRunStepper`（确认输入 / 执行中 / 产物）
- 顶栏右侧增加 `#wbRunBack`（chevron + 返回）→ `backToRunList`
- 压缩 `.wb-run-topbar` 垂直占位；保留 `#wbRunOutcome` Pill

## 静态契约

- `tests/workbench-templates.test.js`：禁止 stepper；要求 `#wbRunBack` + `#wbRunOutcome`

## 命令

```bash
npm test
npm run lint
```

## 手工验收要点

1. 启动任一工作流进入运行面：顶栏无三段步进。
2. 标题左对齐贴顶，右侧「返回」可点，回到货架。
3. 执行失败时标题旁仍见「失败」类 Outcome Pill。
4. 底栏「返回流程」仍可用。
