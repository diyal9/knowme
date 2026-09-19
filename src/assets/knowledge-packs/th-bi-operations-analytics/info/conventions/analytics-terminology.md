# 术语约定（运营分析）

## 1. 语义层 vs 行为层

| 术语 | 含义 |
|------|------|
| 语义层 | 业务怎么说：Metric、Dimension、Segment、Playbook |
| 行为层 | 数据怎么来：Event、Table、Pipeline、Query |

## 2. 「技能」二义

| 义项 | 指什么 | 线索 |
|------|--------|------|
| **游戏技能（默认）** | 战斗/单位技能配置 | Skill.xlsx、技能 ID → **th-config** |
| **Cursor Agent 技能** | `.cursor/skills/*/SKILL.md` | Cursor、Agent、斜杠命令 |

本仓默认讨论**数据分析**；若用户问 Cursor 技能，切换到 `.cursor/skills/th-bi-analytics-assistant/`。

## 3. 与 th-config 边界

| th-config | th-BI |
|-----------|-------|
| 配表、数值、活动配置 | 指标、埋点、SQL、Playbook |
| `raw/*.xlsx` | `kb/okf/*.md` |

## 4. 核心缩写

| 缩写 | 含义 |
|------|------|
| DAU | 日活跃用户 |
| D1/D7/D30 | 次日/7日/30日留存 |
| ARPU | 平均每用户收入 |
| LTV | 用户生命周期价值 |
| OKF | Open Knowledge Format |
