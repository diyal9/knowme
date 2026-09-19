# TE 分析 MCP 集成（查数执行轨）

MCP 服务器：`user-te-mcp-analysis`（ThinkingEngine / 数据分析平台）。调用前须 Read 工具 schema。

Wiki 侧索引：[kb/okf/references/te-mcp-analysis.md](../../../../kb/okf/references/te-mcp-analysis.md)

## 三轨分工（勿混用）

| 轨道 | MCP | 职责 |
|------|-----|------|
| **协议轨** | `user-pango-skillsrv` | 埋点元事件、属性、枚举权威（ingest / lint） |
| **语义轨** | OKF Wiki | 指标口径定义、Playbook、Conflict |
| **执行轨** | `user-te-mcp-analysis` | 业务词 → QP → 跑数、看板、下钻 |

- TE 的 `list_events` **≠** 盘古 `list_events`（不同 `projectId`、命名空间）。
- **改 Wiki ≠ 改 TE 报表**；**TE 查数结果 ≠ 自动更新 Wiki 口径**。

## 项目 ID

1. `list_projects`（TE）→ 取分析用 `projectId`
2. 盘古 `list_user_projects` → 埋点校验用 `project_id`
3. 两者映射须在项目 Wiki `projects/<slug>/` 或 Metric 页注明；**禁止静默假设相同 ID**

## Guided ad hoc（推荐）

用户要**数字/趋势/下钻**时，优先走 **builder → query_adhoc**，**不要**先 `list_events` / `list_properties` 再手拼 QP。

| 用户意图 | Builder | query_adhoc modelType |
|----------|---------|------------------------|
| DAU、事件次数、ARPU 分子等 | `build_event_analysis_qp` | `event` |
| D1/D7 留存 | `build_retention_analysis_qp` | `retention` |
| 漏斗 | `build_funnel_analysis_qp` | `funnel` |
| 用户属性分布 | `build_prop_analysis_qp` | `prop_analysis` |

### 标准流程

1. 确认 TE `projectId` + 用户**明确时间范围**（event/retention/funnel **禁止**默认近 7 天）
2. 读 Wiki Metric 的 `# Definition` 与 `# TE Query Hint`（若有）
3. 调对应 **builder**；仅当 `status=generated` 时调 `query_adhoc`
4. builder 失败 → **停止**，向用户澄清；**禁止**用 `list_events` 或 `get_analysis_query_schema` 作 fallback
5. 需要用户列表 → `drilldown_users`（qp 须与上一步一致）
6. 口径与 Wiki 不一致 → 并列 + Conflict（见 [te-analysis-policy](../../../../kb/okf/synthesis/te-analysis-policy.md)）

### 时间范围 mode 速查

- `recent` + `day` + `7`：含今天的最近 7 天
- `previous` + `day` + `7`：过去 7 天（**不含今天**）
- 用户说「过去 7 天 / 上周」→ 用 `previous`，勿用 `recent`

## 低层 / 报表路径（非 guided 默认）

| 场景 | 工具 |
|------|------|
| 已有报表 | `list_reports` → `get_report_definition` → `query_report_data` |
| 看板 | `list_dashboards` → `query_dashboard_report_data` |
| 手拼 QP | `get_analysis_query_schema`（**非** guided 首选） |
| 元数据浏览 / ingest 对照 | `list_events`、`list_properties`（**非** builder 前置） |

## 与 Wiki Metric 的对应

见各 Metric 页 `# TE Query Hint` 与 [te-mcp-analysis.md](../../../../kb/okf/references/te-mcp-analysis.md) 映射表。

核心示例：

- **DAU**：`build_event_analysis_qp` → `metrics: [{ event: '<登录事件名>', aggregation: 'user_count' }]`
- **D7**：`build_retention_analysis_qp` → `retention: { initialEvent, returnEvent, unitNum: 7 }`（cohort 由 TE 事件定义，可能与 Wiki「注册日 T」不同 → 见 open Conflict）
- **ARPU**：`build_event_analysis_qp` → 公式指标：`sum(付费金额)/user_count(登录)` 或项目 saved metric（待项目对接事件名）

## Lint（可选）

用户给 TE `projectId` 时：

1. TE `list_events` 与 Wiki `behavioral/events/*.md` 的 `event_name` diff
2. 与盘古 MCP diff **并列**展示，不互相替代
3. 差异写入 `synthesis/conflicts/` 或 Metric 页 `# Edge Cases`

## 写操作

`create_report`、`create_tag`、`create_cluster` 等会改 TE 资源；默认 **query 只读**。用户明确要求创建/更新 TE 资源时，完成后须 `get_resource_url` 返回链接。
