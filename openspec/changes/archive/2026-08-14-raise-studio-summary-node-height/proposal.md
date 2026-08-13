## Why

工作室画布上的专家摘要卡（含「目标」分区）高度预算偏紧，卡片底边与目标文本框被硬裁切，扫一眼读不全。需要加高摘要卡，让目标多露几行、底边完整可见。

## What Changes

- 提高 `sizeForNode` 对 `mode-text`（目标/Prompt）分区的高度预算，并略抬高 agent 等摘要卡地板高度
- CSS：目标区 line-clamp 放宽、分区底部留白加大，避免底边裁切观感
- 更新单测契约：摘要卡仍短于旧内联表单，但目标区高度足够展示更多行

## Capabilities

### New Capabilities

- `studio-summary-node-height`: 工作室画布摘要节点高度与目标可见行数

### Modified Capabilities

- （无）纯展示高度修正，不改编排/保存语义

## Impact

- `src/lib/workbench-studio-canvas.js`（SIZE / sizeForNode）
- `src/workbench-console.css`（flow-sections / mode-text）
- `tests/workbench-studio-canvas.test.js`

## 目标用户

在工作室编排专家协作流程、需要扫读节点目标的创作者。

## 验收标准

- 专家节点「目标」框底边完整，不被卡片底边裁切
- 同等文案下至少可见约 4 行目标摘要（超出仍省略）
- 底部连接点完整可见（不被节点 overflow 裁切）
- `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不恢复画布内联编辑表单
- 不改 Inspector / 保存布局协议
- 不改连线算法与自动布局列间距策略（仅高度变化带来的自然重排）
