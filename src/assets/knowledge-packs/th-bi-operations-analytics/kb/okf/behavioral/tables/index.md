# Tables

**状态：active（逻辑层）** — 百炼英雄最小数仓链路已 ingest；`resource` 为 `logical://` 占位，**物理表名待 raw 数仓文档校准**。

## 百炼英雄（temperedheroes）

| Layer | Concept | 说明 |
|-------|---------|------|
| dwd | [dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md) | 事件明细（含 t_default 表头） |
| dim | [dim_temperedheroes_user_logical](/behavioral/tables/dim_temperedheroes_user_logical.md) | 用户 cohort 维度 |
| dws | [dws_temperedheroes_user_daily_logical](/behavioral/tables/dws_temperedheroes_user_daily_logical.md) | 用户日聚合 |
| ads | [ads_temperedheroes_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md) | 首充 AB 日应用层 |

## 链路

* Pipeline：[pip_temperedheroes_te_event_to_dwd](/behavioral/pipelines/pip_temperedheroes_te_event_to_dwd.md)
* Queries：[behavioral/queries/](/behavioral/queries/)
* Ingest 说明：[数仓逻辑层 ingest](/synthesis/temperedheroes-warehouse-logical-ingest.md)

## 物理表补全

1. 数仓 Schema 文档归档至 `raw/30-data-public-material/common-dictionary/` 或团队指定路径
2. 将各表 `resource` 从 `logical://` 升级为真实库表 URI
3. 跟踪 [百炼就绪度 §P1 #10](/projects/temperedheroes/analytics-readiness.md)
