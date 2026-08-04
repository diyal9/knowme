## Why

Agent 空状态已经提供清晰的任务入口，额外的大型“打开能力 Hub”卡片会抢占首屏注意力并重复左侧 rail 的统一能力入口。移除后可让空状态更聚焦于立即开始工作。

## What Changes

- 移除 Agent 初始空状态中的“打开能力 Hub”卡片
- 保留左侧 rail 的单一“能力”入口和设置页能力管理入口
- 删除仅服务于该空状态卡片的点击委托逻辑

## 目标用户

- 希望打开 Agent 后直接选择工作任务或输入目标的知识工作者

## 验收标准

- Agent 无消息时不再显示“打开能力 Hub”卡片
- 会议总结、今日优先级、查文档/知识库和聊天分析入口保持不变
- 左侧“能力”入口仍可正常打开统一 Hub

## 非目标（Non-goals）

- 不移除左侧 rail 或设置页的能力管理入口
- 不改变 Capability Hub 页面和 Tab
- 不调整其他空状态任务卡片

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: Agent 空状态不再承担 Capability Hub CTA

## Impact

- `src/workspace.html`
- `src/workspace-agent.js`
- `tests/workspace-capability-rail.test.js`
- 无 IPC、运行时或数据变更
