## Why

工作流首页/维护卡「简要流程」步骤 pill 被 `max-width: 9.5em` 截断，长门禁名（如「负责人与截止日校验」）末字被裁切，扫读不完整。

### 目标用户

- 主：在货架扫读官方/个人工作流步骤的用户

### 商业化与体验价值

简要流程是选卡关键信息；标签可读可降低误选与二次点开成本。

## What Changes

- 简要流程步骤 pill MUST 完整展示节点标题（卡片宽度内可折行排布），MUST NOT 以固定窄 `max-width` 裁切末字
- 步骤元素提供完整 `title` 悬停提示（极端超长时兜底）
- 首页货架与维护页共用同一套步骤样式

### 验收标准

1. 「会议闭环」简要流程中「负责人与截止日校验」完整可见、无末字裁切
2. 其它长步骤名同样完整；步骤仍可换行排布
3. `npm test` + `npm run lint` 通过

### 非目标（Non-goals）

- 不改节点真源命名 / graph schema
- 不改产出 chips 的省略号逻辑
- 不重做 DAG 详情视图

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：简要流程步骤标签 MUST 完整可读。

## Impact

- `src/workbench-shelf.css`：`.wb-workflow-manage-flow-step`
- `src/workbench.js`：`workflowBriefFlowHtml` 增加 `title`
- `tests/workbench-templates.test.js`
- 证据：`openspec/changes/fix-workflow-brief-flow-step-clip/evidence/`
