# 制作人验收

## 验收结论

PASS（live 后端按环境条件保留 advisory/blocker，不影响 hermetic 硬门禁）。

## 用户价值验收

- 取消、查询、恢复和终态不再依赖主进程中的第二份子 Run 注册表，降低“界面显示已取消但后台仍运行”的风险。
- 运行日志被篡改或中段损坏时明确拒绝恢复，避免基于不可信状态继续执行。
- agent package 可通过 SHA-256 锁定内容，并可选用可信发布者 Ed25519 签名认证；撤销、不可信、篡改和未经审阅的权限扩张均拒绝加载。
- Cursor、Claude、Daemon 后端在执行前先验证 readiness/capability；环境不完整时给出缺失条件与复跑命令，不伪造成功。
- 结构化指标可定位取消延迟、恢复结果、重复终态、资源泄漏和信任拒绝。

## 场景验收

| 场景 | 结果 |
|---|---|
| 正常完成 | PASS |
| 明确失败 | PASS |
| 澄清后继续 | PASS |
| 取消与取消风暴 | PASS |
| 中断后恢复 | PASS |
| 重复 terminal/callback | PASS，仅交付一次终态 |
| 日志尾部截断 | PASS，可审计恢复 |
| 日志中段损坏/哈希断链 | PASS，fail-closed |
| package 篡改/撤销/不可信 publisher | PASS，fail-closed |
| 权限扩张未审阅 | PASS，fail-closed |
| 网络 timeout/disconnect | PASS，结构化失败且无残留资源 |

## 非阻塞边界

- 真实 Cursor/Claude/Daemon 的可执行结果取决于当前机器的 token、endpoint 和服务健康度。该结果不替代 hermetic 硬门禁，也不会在缺少前置条件时标记 PASS。
- 本次不改变 `AgentRunExecutor` 的单 Run model/tool loop，不做 UI 或无关架构重构。
