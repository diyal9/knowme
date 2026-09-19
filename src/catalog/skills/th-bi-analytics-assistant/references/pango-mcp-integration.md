# 盘古 MCP 集成（行为层校验）

MCP 服务器：`user-pango-skillsrv`。调用前须 Read 工具 schema。

## 常用工具映射

| 用户意图 | 工具 |
|----------|------|
| 有哪些埋点事件 | `list_events` |
| 事件有哪些属性 | `list_event_properties` |
| 枚举 / 维度 | `list_dimensions`、`get_dimension_info` |
| 需求绑定的埋点 | `get_requirement_buried_point` |
| 我的项目 | `list_user_projects` |

## 查数澄清阶段（L0 / L2）

与 [multi-project-query-clarification.md](multi-project-query-clarification.md) 配合；**仅澄清选项**，非 builder fallback。

| 澄清参数 | 盘古 MCP | TE MCP（`user-te-mcp-analysis`） |
|----------|----------|----------------------------------|
| L0 项目列表 | `list_user_projects` → `project_id` | `list_projects` → `projectId`（≠ 盘古 id） |
| L2 用户属性 platform | — | `list_properties(projectId, scope=user, query=platform)` |
| L2 埋点枚举（如 PACKAGE_TYPE） | `list_dimensions` → `get_dimension_info(name=…)` | — |

双 ID 映射以 Wiki `projects/<slug>/index.md` 为准；禁止静默假设盘古 id = TE id。

## Ingest 校验流程

1. 用户确认 `project_id`
2. MCP 拉事件/属性/枚举
3. 与 Wiki Concept diff
4. 更新 `behavioral/events/*.md`；不一致 → Conflict

## 写操作

`add_event`、`edit_event`、`apply_requirement_buried_point` 等**有白名单与审批**；默认仅 **Lint/ingest 只读**。用户明确要求改协议时，转述 MCP 错误与审批要求。

## 与配置中心枚举

数据中心枚举（MCP）≠ 配置中心枚举（`query_enum_config`）。分析埋点用前者；Excel 转义用 th-config。

## 与 TE 分析 MCP

查数执行见 [te-mcp-analysis-integration.md](te-mcp-analysis-integration.md)。盘古校验协议，TE 跑数；**禁止**用 TE `list_events` 替代盘古 ingest 校验。
