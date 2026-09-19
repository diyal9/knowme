# Events

## 跨项目模板

* [LoginEvent — 登录](/behavioral/events/LoginEvent.md) — 通用登录模板（百炼生产名见 `t_login`）
* [PayEvent — 付费](/behavioral/events/PayEvent.md) — 通用付费模板（百炼生产名见 `t_pay_flow`）

## 百炼英雄（temperedheroes · project_id=69）

* [t_register — 注册](/behavioral/events/t_register.md)
* [t_login — 登录 / DAU](/behavioral/events/t_login.md)
* [t_pay_flow — 支付成功](/behavioral/events/t_pay_flow.md)

全量目录：[MCP 埋点与 TE 资产目录](/synthesis/temperedheroes-mcp-event-catalog.md)

## 指尖战纪 FF（fingertipff · 盘古 project_id=82 · TE 249）

生产事件名与百炼相同（`t_register` / `t_login` / `t_pay_flow`），但 **属性与过滤器不同**（无 `area_id`、金额字段 `cost`）。

* [t_register — 注册](/behavioral/events/t_register_fingertipff.md)
* [t_login — 登录 / DAU](/behavioral/events/t_login_fingertipff.md)
* [t_pay_flow — 支付成功](/behavioral/events/t_pay_flow_fingertipff.md)
* [FF vs 百炼字段对照](/synthesis/ff-vs-temperedheroes-field-diff.md)

## Properties
* [platform](/behavioral/events/properties/platform.md) — 平台属性
* [channel](/behavioral/events/properties/channel.md) — 渠道属性
