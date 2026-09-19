# 门禁与冲突检查

写入飞书前**按序**执行；任一步失败则 **禁止写入**。

## 1. preview_rows

- 取映射后前 N 行（默认 3），以 Markdown 表格展示：**源 → 目标列 → 最终值**
- 标注 skipped 列（公式 / 只读）
- 0 行有效数据 → 中止

## 2. conflict_check（可选，th-BI 分析场景）

规则 `gates.conflict_check.metrics` 非空时：

1. 读 OKF Metric 页（[okf-progressive-loading](../../th-bi-analytics-assistant/references/okf-progressive-loading.md)）
2. 读 memory `working/recent.jsonl` 中 `correction` / `business_theory`
3. 若映射字段含指标口径（如留存分母、日期归属）→ 与 Metric 定义对照
4. 若涉及 TE 数值 → 可选对照当次 MCP 返回

**冲突时**（[authority-and-conflicts](../../th-bi-analytics-assistant/references/authority-and-conflicts.md)）：

- 并列：Wiki 说法 / memory 说法 / 本次数据 / MCP
- open Conflict 页 → **不得**作为唯一依据静默填表
- 请用户选择口径或修正规则后再 preview

## 3. user_confirm

默认 **必须** 用户明确同意（「确认写入」「可以填」等）后才调用 `lark-cli` 写接口。

例外：用户在同一条消息中已写「按规则直接填，不用再确认」→ 可写入 personal 规则 `gates.user_confirm: false`（须用户确认保存规则时一并设定）。

## 4. 业务事实 vs 记忆升库

填表完成后，若出现以下情况，按 [promotion](../../th-bi-agent-memory/references/promotion.md) 询问（**不自动升库**）：

| 信号 | 建议 |
|------|------|
| 用户指正映射/口径 | `correction` → working；≥3 次 → Wiki? |
| 用户说明业务规则 | `business_theory` → 个人或 OKF |
| 同一 rule_id 第 3 次成功填表 | Playbook 已存在则跳过；否则提示固化规则到 Wiki |
| 仅单次数值 | **不升库**，只写飞书 |

**护栏**：个人 memory 中的 habit **不能**覆盖 OKF Metric 口径；冲突时 Wiki 优先（见 rule-discovery §5）。

## 5. 禁止

- 未经 preview 写入
- 未经 user_confirm（且规则未关闭门禁）写入
- 将未确认的个人记忆当作团队口径写入 OKF
- 在 open Conflict 未关闭且用户未选型时写入口径相关列
