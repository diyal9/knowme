## Context

见 `proposal.md`。货架供给由主进程 `buildWorkflowShelf` 汇集 repo / daemon / personal / verticals 四路；verticals 来自 `workbenchConsoleModel.resolveVerticalPipelines`，即三条硬编码 `VERTICAL_PIPELINE_SEEDS`。

## Goals / Non-Goals

**Goals:**
- 从货架供给切断垂直演示种子注入，且主规格不再要求它们存在。
- 保持个人、仓库、Daemon 三路供给行为不变。

**Non-Goals:**
- 不重做货架 UI。
- 不物理删除 `VERTICAL_PIPELINE_SEEDS` 常量（可留作单测/领域工具），只禁止进入货架。

## Decisions

1. **切断点选在 `buildWorkflowShelf`，传 `verticals: []`**
   - 理由：一处改动能立刻停注入；`collectSeeds` 与 console-model 仍可供单测直接喂入，避免大面积改测试夹具。
   - 备选：删除 `VERTICAL_PIPELINE_SEEDS` 本体——牵连 readiness/automation 测试与历史 id，成本高、收益低。

2. **规格层面 REMOVED「Production vertical workflows」**
   - 理由：该要求与「废除演示」直接冲突；诚实空货架优于强制演示包。
   - 备选：把三条改为真实可执行包——超出本次范围。

3. **货架规格 ADDED「No built-in demo vertical seeds」**
   - 理由：把产品禁令写进 shelf 契约，防止后续 change 再次注入。

## Risks / Trade-offs

- [Risk] 新装用户货架更空 → Mitigation：空状态已有「新建工作流 / 连接 Daemon」引导；不以演示卡充数。
- [Risk] 自动化任务仍引用旧 seed id → Mitigation：Non-goal 只读兼容；启动时若包不存在走既有错误路径。
- [Risk] console-model 测试仍覆盖种子 readiness → Mitigation：允许内部函数继续测种子，只要不进货架即可。

## Migration Plan

1. 发版后货架不再显示三条种子。
2. 用户已复制的「我的版本」继续可用。
3. 若需回滚：恢复 `buildWorkflowShelf` 的 `verticals` 传参即可。
