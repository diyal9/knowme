# 权威来源与冲突处理

## 1. 权威优先级

| 问题类型 | 权威来源 | 说明 |
|----------|----------|------|
| 埋点元事件 / 属性 | 盘古数据中心 MCP | `list_events`、`list_event_properties` |
| 埋点枚举 / 维度 | 盘古数据中心 MCP | `list_dimensions`、`get_dimension_info` |
| 需求绑定的埋点设计 | 盘古 MCP | `get_requirement_buried_point` |
| 指标口径 / Playbook | OKF Wiki `kb/okf/` | 人工 + Agent 策展 |
| 即席分析 / 报表数值 | TE 分析 MCP `user-te-mcp-analysis` | `build_*_analysis_qp` → `query_adhoc`；见 [te-analysis-policy](../../kb/okf/synthesis/te-analysis-policy.md) |
| 非结构化长文档 | Cherry KB / RAGFlow | 向量检索补充 |
| 配表数值 / 玩法配置 | **th-config** 仓库 | 非本仓职责 |

## 2. 冲突协议（强制）

一旦发现 **盘古 MCP / TE 查数 / Wiki / RAG / 用户陈述** 任两者有出入：

1. **不得**静默猜哪一方为准
2. **并列说明**各方内容与可能原因（库滞后、Wiki 未更新、口径变更）
3. **请用户确认**采纳口径或下一步
4. 未裁定前：建或更新 [Conflict](../../kb/okf/synthesis/conflicts/)，`status: open`
5. 裁定后：更新相关 Metric/Event，`Conflict` 标 `resolved`

## 3. draft 状态

frontmatter `status: draft` 表示模板或未对接生产。**回答用户时须声明**「当前为 draft，以 MCP/用户确认为准」。

## 4. 生产环境

盘古 MCP 写操作（`add_event` 等）须遵守平台规则；本仓 Wiki 维护与 MCP 写操作分离，**改 Wiki 不等于改线上埋点**。
