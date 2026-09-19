---
name: lark-sheet-fill
description: 将数数、盘古、CSV 或当轮分析结果按已确认映射写入飞书电子表格或多维表格；当用户说填表、飞书填表、写入表格或给出飞书表格链接与数据时使用。
version: 1.0.0
disable-model-invocation: false
---

# 飞书填表

主目标是飞书 Sheets，Base/多维表格为可选路径。源项目规则完整保留在 `references/`，KnowMe 使用 `run_skill_script` 调用本技能内的 `scripts/lark_sheet_cli.py`，避免裸拼 shell 命令。

## 每次都走的流程

1. 取得目标链接、sheet/table 标识、输入数据和写入意图。
2. 按 [rule-discovery.md](references/rule-discovery.md) 查映射规则；没有规则就按 [onboarding-questions.md](references/onboarding-questions.md) 补齐。
3. 按 [data-adapters.md](references/data-adapters.md) 归一化成 `rows[]`，再按 [rule-schema.md](references/rule-schema.md) 做列映射与转换。
4. 读取目标表头/字段和下拉选项，生成 preview：目标、模式、列映射、示例行、行数、冲突和覆盖风险。
5. 按 [conflict-gate.md](references/conflict-gate.md) 检查。**用户确认前禁止写入**。
6. 用户确认后再运行受控脚本；写后返回 URL、模式、成功/失败行数和真实 CLI 回执。

## 脚本调用

先用 `load_skill`/`read_skill_resource` 核对脚本参数，再调用：

```text
run_skill_script(
  skill_id="lark-sheet-fill",
  script="scripts/lark_sheet_cli.py",
  args=["sheet-read", "--url", "<url>", "--sheet-id", "<id>", "--range", "<range>"]
)
```

写入动作使用 `sheet-append`、`sheet-write`、`base-record-create` 或 `base-record-update`。二维单元格和 Base records 必须通过 `--values-json` / `--records-json` 传合法 JSON；脚本不接受任意 lark-cli 子命令。

## 红线

1. 无规则、映射未确认或 preview 未确认时禁止写入。
2. 公式列跳过；下拉列先读取并校验选项；必填列缺值立即停止。
3. 映射来源冲突时并列展示，不按最近一次或行顺序静默选择。
4. 输出目录、目标表、覆盖范围或 upsert 主键变化后，需要重新 preview 和确认。
5. 规则存入 KnowMe 个人记忆或团队知识库必须由用户选择；不得自动写回。

详细写入模式与回执见 [write-modes.md](references/write-modes.md)。
