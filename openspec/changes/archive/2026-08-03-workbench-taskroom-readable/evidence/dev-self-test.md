# 开发自测: workbench-taskroom-readable

## 环境

- Windows / Electron 桌面便签（KnowMe）
- 纯函数改动可 Node 单测；渲染层为浏览器代码，逻辑经单测覆盖

## 自测项

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 单元/集成测试 | `npm test` | PASS（764 pass / 0 fail / 130 suites） |
| Lint | `npm run lint` | PASS（lint ok；script-scope ok） |
| Harness 硬门禁 | `node .cursor/scripts/harness.js gate --json` | `ok=true`，`blocking=false` |
| 编辑文件诊断 | ReadLints（workbench.js / task-brief.js / task-projection.js） | 无 linter error |

## 关键逻辑验证（新增单测）

- `workbench-task-brief`：新增 `tone`/`headline` 派生
  - done → `tone=done` / `任务已完成`
  - gate → `tone=waiting` / `等待你确认`
  - clarification → `tone=waiting` / 含「补充」
  - running → `tone=running` / `正在执行`
  - failed → `tone=error` / 含「失败」
  - degraded → `tone=muted` / `流程详情暂不可用`
  - 既有 `factualBrief` 契约不变（LLM grounding 用途保留）
- `workbench-task-projection`：`degradedReason` 保留「激活内容源可能与该工作流不匹配」短语，且断言不含 `.cursor/workflows/` 与 workflow id

## 结论

- [x] 开发自测门禁 PASS（无控制台/测试/lint 报错）
- 备注：右栏为 DOM 渲染，视觉呈现建议制作人真机再扫一眼；渲染分支由 `tone`/`headline` 纯函数驱动，已单测。
