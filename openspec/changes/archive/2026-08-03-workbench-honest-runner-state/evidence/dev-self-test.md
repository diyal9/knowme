# Dev Self-Test: workbench-honest-runner-state

日期：2026-08-03  
角色：开发

## 变更范围

- `src/lib/workbench-task-projection.js`：degraded 占位 `degradedPlaceholder`、用户化原因、`summarizeRunnerProgress`
- `src/lib/workbench-task-brief.js`：`classifyWorkbenchPaths`，输入 ≠ 产物
- `src/lib/workbench-presenter.js`：`sanitizeChatSuggestion`
- `src/lib/workbench-repo.js`：`resolveArtifactOpenPath`
- `src/main.js`：artifact-open 走仓库根解析
- `src/workbench.js`：诚实进度、状态一致、degraded 出口、友好打开失败
- `src/workspace-agent.js`：任务上下文过滤输入路径 + 禁止推荐 ingest 产物
- `src/workspace.html`：`.wb-run-degraded-exit` 样式

## 门禁结果

- `npm test`：**PASS**（761 / 761）
- `npm run lint`：**PASS**（lint ok + script-scope ok）

## 关键单测

- degraded → `无法确认进度`，无 `100%` / `已完成 1/1`
- 正常图仍显示真实百分比
- 输入路径不入产物建议；真实产物保留
- 相对产物路径解析 / 穿越拒绝 / 未生成 `not-generated`
- chat 建议脱敏抹掉 `ingest/brief.md`

## 待人工验收

- 制作人：degraded 三处状态一致 + 内容源出口
- 测试：qa-plan Smoke Scope + 反模式
