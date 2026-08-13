## Context

此前 `align-daemon-process-feed-chat-order` 将 progress/logs 挂在左栏对话底，便于「与对话同向」看日志；实际造成对话被系统卡打断，且底栏「过程日志」再次聚焦左栏，体验混乱。

## Goals / Non-Goals

**Goals**

- 过程日志进入右侧 Tab
- 左栏只保留真实对话
- Tab 栏右侧图标刷新；去掉底栏过程日志按钮

**Non-Goals**

- 不删除 `projectProcessTranscript` 纯函数（供 Tab 与测试复用）
- 不强制删除 `setDaemonProcessFeed` API（改为 Daemon 路径清空）

## Decisions

1. **Tab id = `logs`**，标签「过程日志」，插在 `events` 之后。
2. **停止 `syncDaemonProcessFeed` 写入**：Daemon 渲染时调用 `setDaemonProcessFeed(null)`，清理残留过程卡。
3. **`focus-process-logs` → `switchDaemonReviewTab('logs')`**，避免再滚到对话。
4. **刷新按钮**：从 `.wb-daemon-review-foot` 移入 `.wb-daemon-review-tabs` 右侧（`margin-left: auto`），去掉文字 `<span>刷新</span>`；可移除整段 foot 若仅剩过程日志按钮。
5. **logs Tab UI**：复用 transcript 的 progress + logs 两块，样式对齐现有审阅空态/预格式文本。

## Risks / Trade-offs

- 用户习惯「在对话旁看日志」会改变 → 用 Tab 明确分区，推荐文案可提示失败时看过程日志。
- 旧测试断言 `focus-process-logs` / `.wb-daemon-review-foot` 需同步更新。

## Migration

无数据迁移；打开已有失败任务即可验证。
