---
type: Synthesis
title: 三层架构安全性与数据准确性评估
description: 元数据(盘古)/数值(TE)/语义记忆(Wiki)三层架构的准确性风险与机密性评估;含 Langfuse 钩子脱敏缺口与整改建议。
tags: [architecture, authority, accuracy, security, langfuse, policy]
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 三层架构定位(确认)

| 层 | 定位 | 权威来源 | 仓库落点 | 性质 |
|----|------|----------|----------|------|
| **元数据** | 字段长什么样 | 盘古 MCP `list_events` / `list_event_properties` / `list_dimensions` | `behavioral/events/` | 实时权威 |
| **数值** | 数字是多少 | TE MCP `query_adhoc` | Metric `# TE Query Hint` | 实时权威 |
| **语义 / 沟通 / 分析知识** | 口径为什么这么算 + 怎么分析 | OKF Wiki `kb/okf/` | metrics / playbooks / synthesis | 策展快照(长期记忆) |

> 前两层是真相源(source of truth);第三层是记忆与解释层,**不可反向覆盖前两层**。
> 详见 [authority-and-conflicts](../../../info/conventions/authority-and-conflicts.md)、[te-analysis-policy](/synthesis/te-analysis-policy.md)、[conflict-resolution-checklist](/synthesis/conflict-resolution-checklist.md)。

# A. 数据准确性评估

## 风险点

| # | 风险 | 严重度 | 现有缓解 | 残留缺口 |
|---|------|--------|----------|----------|
| 1 | 本地层 stale:Wiki 是快照,盘古/TE 会变 | 中 | lint/ingest + `last_verified` + L1/L2 两层模型 | lint 依赖人工触发,无自动 diff |
| 2 | 把记忆当真相:draft/快照被当生产口径 | 中高 | `status: draft` 声明 + guardrails + open Conflict 不得作唯一依据 | 靠 Agent 自律,无代码级拦截 |
| 3 | TE 衍生事件混入协议(`m_*`、`t_ads_*`) | 中 | catalog 标注「非协议轨」 | 误用会偏数仓口径 |
| 4 | project 映射错(盘古 69 ≠ TE 101) | 高 | guardrails + checklist Step 0 | — |
| 5 | 枚举值漂移(pin 快照过期) | 中 | 「分析时 MCP 现查」优先 + `last_verified` | 过期判断靠人看 |
| 6 | 金额单位未裁定(`generalcost` 分/厘/元) | 高(对外报数) | readiness P0-1 + guardrails 禁报「元」 | 仍 open |
| 7 | 权限盲区(当前账号仅 project 69 可读) | 中 | 越权直接报错,不静默 | 跨项目无法 MCP 校验,只能声明 |

## 结论

架构本身**不会**导致不准确;前提是 **ingest → lint diff → Conflict → 裁定回写** 闭环成立。
真正脆弱点是**节奏**(lint 手动)而非设计:lint 漏做 → 本地记忆悄悄偏离真相源 → Agent 复用记忆 → 不准确(风险 1+2 叠加)。

**建议**:将 readiness P2-13「per-project lint 脚本」提前,做事件名/字段/枚举快照 diff,把「人记得 lint」变「系统提醒 lint」。

# B. 内容机密性评估

## 已具备的防护

| 项 | 状态 |
|----|------|
| `.env` / `.env.*` 已 `.gitignore`(仅 `.env.example` 入库) | ✅ |
| `.cursor/mcp.json`、langfuse session 已忽略 | ✅ |
| Langfuse 密钥从 `os.environ` 读取,不写入 payload | ✅ |
| 写盘范围:operator 仅 `kb/okf/**`,raw 只读 | ✅ |
| 钩子异常吞掉,不阻塞 | ✅ |

## ⚠️ 缺口:Langfuse 钩子脱敏是「按 key 名」,非「按 value」

`.cursor/hooks/langfuse_cursor_hook.py` 的 `redact()` 仅对**键名**(`password`/`secret`/`token`/`api_key`...)打码,对**字符串值不做密钥/PII 扫描**,只截断到 4000 字符。

**后果**:
- 钩子捕获 `beforeReadFile`/`afterFileEdit` 的**文件内容**(挂在 `content` 普通键下)。读取 `.env` 本身时,其内容**不脱敏、仅截断**后外发 Langfuse(默认 1/N 采样;`CURSOR_HOOK_LANGFUSE_TRACE=1` 全量)。
- MCP 工具结果若含明文 PII(盘古埋点 `ip`、`country`、`extra_msg`含绑定手机、`user_name`)同样只截断不脱敏。

> 该缺口属**机密性**,与数据准确性无关。

## 整改建议(优先级)

| 优先级 | 动作 |
|--------|------|
| P0 | `redact()` 增加**值级**密钥/PII 正则(`sk-`、`AKIA`、邮箱、手机号、身份证),命中值打码 |
| P0 | `beforeReadFile` 命中 `.env`/`.env.*`/`credentials`/`*.pem` 的文件内容**直接不上报** |
| P1 | 确认 Langfuse 自托管 vs SaaS;SaaS 则埋点 PII 外发需合规评估 |
| P1 | 默认关闭 `CURSOR_HOOK_LANGFUSE_TRACE` 全量,保持采样并文档化 |
| P2 | 工具结果对 PII 字段(`ip`/`extra_msg`/`user_name`)字段级打码 |

> 整改触及 `.cursor/**`,须 `maintainer` 角色 + 用户书面授权路径(见 [rdpi-agent-workspace-policy.yaml](../../../rdpi-agent-workspace-policy.yaml))。本页仅记录,未执行代码改动。

# 总评

| 维度 | 评级 | 说明 |
|------|------|------|
| 架构合理性 | 良好 | 三层分轨 + Conflict + lint 是正确范式 |
| 数据准确性 | 可控,依赖节奏 | 主风险为本地层 stale + 当记忆用;建议自动化 lint diff |
| 内容机密性 | 需收口 | 钩子脱敏粒度不足,`.env`/PII 经工具结果可能外发 Langfuse |

# Citations

[1] [authority-and-conflicts](../../../info/conventions/authority-and-conflicts.md)
[2] [te-analysis-policy](/synthesis/te-analysis-policy.md)、[conflict-resolution-checklist](/synthesis/conflict-resolution-checklist.md)
[3] `.cursor/hooks/langfuse_cursor_hook.py`(redact 558–574 行、_SENSITIVE_KEY_RE 539–549 行)
[4] [rdpi-agent-workspace-policy.yaml](../../../rdpi-agent-workspace-policy.yaml)、[analytics-readiness](/projects/temperedheroes/analytics-readiness.md)
