# Design: workbench-honest-runner-state

## 进程/边界

| 层 | 文件 | 职责 |
|----|------|------|
| 渲染 | `src/workbench.js` | `progressSummary()` / `renderTaskContext()` / 产物点击；degraded 出口 |
| 渲染 | `src/workspace-agent.js` | 左侧助手下一步建议文案（经 presenter 脱敏） |
| 逻辑 | `src/lib/workbench-task-projection.js` | degraded 占位节点标记（`degradedPlaceholder: true`） |
| 逻辑 | `src/lib/workbench-presenter.js` | 内部路径（`ingest/` 等）脱敏，扩展到 chat 建议 |
| 主进程 | `src/main.js` | `workbench-daemon-artifact-open`：相对路径→仓库根解析 |

渲染层不新增 IPC；仅 `artifact-open` handler 增加路径解析，仍在主进程内完成（不越权访问渲染层）。

## 关键改动

### 1. 诚实进度（`progressSummary`）

当前 `src/workbench.js:1742` 在 `list.length === 1 && run.status === 'done'` 时强制 100%。改为：

- degraded 占位节点由 projection 标记 `degradedPlaceholder: true`
- `progressSummary()` 先过滤占位节点；过滤后 `length === 0` 且处于 degraded → 返回「无法确认进度」
- 顶部 `#wbRunProgress`、`#wbRunStatus`、执行节点区共享同一状态判定，避免三处矛盾

### 2. 只展示真产物

- 产物来源唯一化：仅 `run.artifacts`（Daemon `/artifacts` 返回）可进入 `#wbRunArtifacts`
- 输入路径（`inputs.root` / `inputs.prd`）在 `workbench-task-brief` 中标注为「输入」，presenter 生成建议时排除输入路径，不产出「查看产物 ingest/brief.md」类文案

### 3. 产物相对路径解析（`main.js` artifact-open）

```
if (isAbsolute(p)) openPath(p)
else {
  repo = resolveActiveRepo(store)
  target = join(repo.root, p)
  if (exists(target)) openPath(target)
  else return { ok:false, reason:'not-generated' } // 渲染层转友好提示
}
```

拒绝目录穿越（`..`）后再解析，复用 `workbench-repo.resolveWorkflowFile` 的安全校验思路。

### 4. degraded 出口

`renderTaskContext()` 的 degraded 分支追加行动按钮「打开内容源设置」，复用现有设置跳转 IPC；文案改为用户化并说明「激活内容源可能与工作流不匹配」。

## 性能/内存

- 无新增轮询、无新增依赖；仅本地字符串与路径判断，启动路径不受影响。

## 风险

- `progressSummary` 被 `tests/workbench-templates.test.js` 等间接约束，改动需保持既有非 degraded 分支行为不变（线性/正常任务仍显示真实百分比）。
- artifact-open 相对路径解析依赖激活内容源正确；解析失败必须走友好提示而非报错。
