# QA Plan

## Smoke Scope

- [x] `npm run lint`：architecture 对 1200～2000 行打 WARN 不失败
- [x] 白名单仅含实际 >2000 的路径
- [x] 文档与 rule 写明 1200 告警、2000 硬顶

## 反模式

- 为过行数再拆单一职责模块
