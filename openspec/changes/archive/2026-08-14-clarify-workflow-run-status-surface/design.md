## Context

运行壳已是接管式三段（确认输入 → 执行中 → 产物）。现状问题：

1. 顶栏左侧「返回货架」与 runner 底栏「返回流程」语义重复。
2. 步进条把 `running` 阶段高亮成用户眼中的「状态 chip」，卡内 `elRunnerMeta` 又写「执行失败」，同屏矛盾。
3. Daemon 审阅面与本地 runner 都没有稳定的 L1 结论位。

## Goals / Non-Goals

**Goals**

- 三层模型：L0 阶段 / L1 任务结论 / L2 节点进度。
- 单一真相：L1 只在顶栏 Outcome Pill。
- 去掉顶栏返回；退路仍在底栏 + 货架进行中入口。

**Non-Goals**

- 不改 `collectRunInputs` / confirm / start / cancel IPC。
- 不引入新状态枚举源；复用 `workbenchTaskContext` / `terminalKind` / `run.status`。

## Decisions

1. **删除 `#wbTaskBackToList`**  
   绑定与节点一并移除。`backToRunList()` 仍由底栏 `data-run-action="back"` 与输入页「取消」等路径调用。

2. **顶栏 = 工作流名（标题行）+ Outcome + 副说明（同一 meta 行）**  
   - 确认输入：Pill 隐藏；副说明保留「产出：…」。  
   - 执行中 / 产物：Pill 与副说明同字号、同基线，弱于标题（色点 + 短标签，非标题级实心 pill）。  
   - tone class：`running | waiting | done | error | muted`。
   - 审阅 Tab 不挂「推荐」角标；推荐仅通过 meta 文案「推荐查看「…」」表达。

3. **`elRunnerMeta` = L2 only**  
   Daemon / agent-graph：`{当前节点} · {progressSummary}` 或等待门禁短句；禁止单独输出「执行失败」「已完成」作为 meta 主句（结果已由 Pill 表达）。

4. **步骤 Tab 顶部小结条**  
   Daemon steps 非空时首行渲染「当前节点 · 进度」条；失败节点仍用 step 色点。

5. **文案映射**  
   | 内部 | Pill |  
   |---|---|  
   | active / running / queued | 执行中 |  
   | waiting / gate / clarify | 等待你 |  
   | success / done | 已完成 |  
   | failure | 失败 |  
   | cancelled | 已取消 |  
   | degraded 非终态 | 详情受限 |  

## Risks / Trade-offs

- 历史 electron smoke 依赖 `#wbTaskBackToList` → 改为底栏 `data-run-action="back"` 或 `backToRunList` 调用路径。
- 旧 spec 曾写「MUST 显示返回货架退路」→ delta 改为「MUST 提供回到货架的退路（底栏/货架入口），不强制顶栏按钮」。

## Migration

无数据迁移。
