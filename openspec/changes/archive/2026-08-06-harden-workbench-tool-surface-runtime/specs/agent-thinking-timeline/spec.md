## ADDED Requirements

### Requirement: toolTimelineTitle readable summaries

工具时间线步骤 title MUST 通过 `toolTimelineTitle`（或等价）生成可读摘要：write/patch → 文件名；move → `源 → 目标`；飞书 → 类型+标题；mkdir 直建 → 路径 +「低风险直建」。

#### Scenario: Move shows arrow summary

- **WHEN** move_path 工具完成
- **THEN** 时间线 title 含 `a.txt → b.txt` 形式摘要

#### Scenario: Mkdir direct create label

- **WHEN** 低风险 mkdir 直建成功
- **THEN** title 含「低风险直建」与相对路径
