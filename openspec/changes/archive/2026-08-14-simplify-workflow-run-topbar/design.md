## Context

`clarify-workflow-run-status-surface` 曾把顶栏返回去掉、保留三段步进作 L0 阶段。实机体验反馈：步进不可点却像按钮；标题区偏挤；右侧缺少明确返回。

## Goals / Non-Goals

- Goals：去掉装饰步进；顶栏右侧「返回」；标题+Pill 贴顶。
- Non-Goals：不改阶段状态机 `setRunStage`、底栏动作、Outcome Pill 映射。

## Decisions

1. **删除 `#wbRunStepper` DOM 与相关 CSS/JS 高亮逻辑**  
   `setRunStage` 仍切换三阶段内容面；不再维护步进 class。

2. **顶栏右侧 `#wbRunBack`**  
   样式对齐 `.wb-task-back`（chevron +「返回」）。点击调用既有 `backToRunList()`。确认输入阶段也显示（与「取消」并存：取消偏表单放弃，返回偏退回货架；两者最终都可回到货架语义）。

3. **Outcome Pill 保留**  
   仍是唯一全局结论文案位；不再依赖步进表达「执行中」。

4. **顶栏压缩**  
   `min-height` / padding 下调，去掉 stepper 后右侧留给返回。

## Risks / Trade-offs

- 新手少了「三阶段总览」→ 由内容面徽章（确认输入 / 审阅制品 / 产物）兜底。
- 顶栏与底栏双返回 → 可接受；顶栏为主退路、底栏为审阅操作旁次要退路。

## Migration

无数据迁移。静态测试从「禁止顶栏返回 / 要求 stepper」改为「要求 `#wbRunBack` / 禁止 `#wbRunStepper`」。
