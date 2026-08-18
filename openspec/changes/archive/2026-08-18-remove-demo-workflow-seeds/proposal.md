## Why

工作台「工作流」货架仍在注入三条内置垂直切片种子（会议纪要 / 研发交付 / 视觉 Brief）。它们多数缺专家、无完整 graph，以「团队」标签占位并常显示「暂不可用」，看起来像 Demo/演示流程，干扰用户挑选真实可跑工作流。

目标用户：把 KnowMe 当生产力工具、只想启动自己或团队真实流程的用户。

商业化与体验价值：货架只展示真实供给（个人编排、仓库 `.cursor/workflows/`、Daemon 目录），降低「演示占位」带来的不可信感与支持成本。

## What Changes

- **BREAKING**：工作流货架不再注入 `VERTICAL_PIPELINE_SEEDS`（`office-meeting-to-actions`、`engineering-delivery`、`visual-brief-to-export`）。
- 废除主规格中「办公/研发/视觉各至少一条垂直演示 Workflow Package」的强制要求。
- 货架继续展示用户「我的」工作流、仓库投影与 Daemon 目录中的真实条目；已从种子「复制并调整」出的个人副本不受影响。
- 供给诊断与空状态如实反映「无演示种子」后的真实库存。

验收标准：
- 工作流货架上不再出现上述三条内置团队演示卡。
- 个人副本（如「会议资料 → 纪要与待办 (我的版本)」）与「我的智能体协作」仍可见。
- 仓库 / Daemon 真实工作流仍可上架与启动。
- 相关单测与 lint 通过。

非目标（Non-goals）：
- 不删除用户已保存的个人工作流数据。
- 不改 Team Runtime / Daemon 执行内核。
- 不新增替代演示内容或营销占位卡。
- 不清理历史自动化任务里对旧 seed id 的引用（既有 run 只读兼容即可）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: 移除「Production vertical workflows」对三条内置垂直演示包的强制供给要求。
- `workbench-workflow-shelf`: 明确货架 MUST NOT 注入仅用于演示/占位的内置垂直切片种子。

## Impact

- `src/main.js`：`buildWorkflowShelf` 停止传入 `resolveVerticalPipelines`。
- `src/lib/workflow-supply.js`：种子收集路径可保留兼容，但默认无垂直演示输入。
- `src/lib/workbench-console-model.js`：种子常量可保留供内部/测试，但不再进入货架。
- `tests/workflow-supply.test.js` 及相关 console/launch 测试按新契约调整。
- OpenSpec：`openspec/specs/workspace/spec.md`、`workbench-workflow-shelf/spec.md` 的 delta。
