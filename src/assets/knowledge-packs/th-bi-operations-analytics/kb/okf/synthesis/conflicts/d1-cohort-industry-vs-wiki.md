---
type: Conflict
title: D1/D7 cohort — 行业「首日新增」vs Wiki「注册日」
status: open
parties:
  - 行业术语手册（留存）：cohort 为「首日新增用户」（D1、7留等）
  - OKF Wiki d1_retention / d7_retention：cohort 为「注册日 T」用户
  - 待项目确认：新增 vs 注册 vs 首次登录
timestamp: 2026-06-17T12:00:00Z
---

# 差异

| 来源 | cohort 定义 |
|------|-------------|
| [行业术语 — 留存](/references/industry-glossary/retention.md) | **首日新增**的用户，统计日仍登录（D1=次日，7留=第7天） |
| [d1_retention](/semantic/metrics/d1_retention.md) | **注册日 T** 的用户，T+1 有 LoginEvent |
| [d7_retention](/semantic/metrics/d7_retention.md) | **注册日 T** 的用户，T+7 有 LoginEvent |

# 可能影响

- 预注册、游客转正、延迟注册会导致「新增日 ≠ 注册日」。
- 渠道报表若按「首次打开」计新增，与注册 cohort 不一致。

# 建议裁定

项目内统一选一：注册成功 / 首次登录 / 账号创建，并在 Metric 与 RegisterEvent 补链后标 `resolved`。

# 项目侧记（百炼 · project_id=69）

| 项 | 百炼生产口径 |
|----|-------------|
| cohort | **注册日 T** = `t_register` 事件日 |
| 留存 | `t_register` → `t_login`，见 [metric-implementation](/projects/temperedheroes/metric-implementation.md) |
| 全局 Conflict | 仍为 **open**（其他项目 / 全局 Metric 未统一） |

百炼 TE 查数：**勿**用行业「首日新增」替代 `t_register` cohort，除非数据组另行裁定。

# 相关

- [industry-glossary-policy](/synthesis/industry-glossary-policy.md)
