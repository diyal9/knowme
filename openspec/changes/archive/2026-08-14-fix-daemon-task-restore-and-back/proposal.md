## Why

冷启动会把已失效的 Daemon 任务草稿强行恢复成运行审阅页；点「返回」又要先等一轮 `workbenchLoad`，之后常落到「专家协作」而不是管线服务首页。排查闭环被打断，管线入口显得不可信。

### 目标用户

日常在管线服务里查看/恢复 Daemon 任务、重启 KnowMe 后继续工作的用户。

### 商业化与体验价值

启动即落入失效任务房、返回卡顿且跳错 Tab，会让人以为管线服务「卡住了」。修顺恢复与返回，是远程执行入口的基本信任门槛。

## What Changes

- 冷启动仅恢复仍可找回的进行中 Daemon 任务；已结束、已清除或不在任务列表中的草稿不再自动打开任务房。
- 从草稿 / launchIntent 恢复 Daemon 任务时，默认返回来源为管线服务（可被显式 `returnState.surface` 覆盖）。
- 「返回」先切回一级面，再后台刷新目录；不再阻塞等待 `refreshRunDirectory`。
- 静默恢复若发现任务不存在，清理本地草稿并留在概览面，不滞留错误运行页。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-workbench`：Daemon 任务冷启动恢复与运行面返回的性能 / 落点语义。

## 验收标准

- 重启后：失效 / 已清除 slug 的草稿不再自动弹出 Daemon 任务房。
- 仍在管线任务列表中的进行中任务可静默恢复，且「返回」回到管线服务。
- 从管线打开任务后点返回：立刻离开任务房，最终落在管线首页（无明显等待后再跳）。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改 Daemon 轮询 / SSE / 审阅 Tab 内容结构。
- 不做多级浏览器历史栈。
- 不清理历史已归档 OpenSpec change。

## Impact

- `src/workbench.js`：`openDaemonTask` / `restoreTaskFromDraft` / `openExistingLaunchRun` / `backToRunList`
- `tests/workbench-templates.test.js`
- OpenSpec：`openspec/changes/fix-daemon-task-restore-and-back/`
