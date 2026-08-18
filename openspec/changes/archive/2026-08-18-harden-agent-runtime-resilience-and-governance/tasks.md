## 1. 状态源收口与运行一致性

- [ ] 1.1 梳理并标记 legacy `activeSubRuns` 依赖点，建立 RunManager-only 查询与控制路径
- [ ] 1.2 增加状态镜像一致性断言与迁移开关，完成灰度切换
- [x] 1.3 移除主路径双轨读写逻辑并保留最小兼容回退开关（`cancelAllSubRuns` 主路径 + adapters 恢复）

## 2. 远程健康探针与自动降级

- [x] 2.1 为远程 adapter 增加健康探针指标（握手成功率、超时率、恢复时延）
- [x] 2.2 实现策略化降级（自动降级/阻断）并接入调度器
- [x] 2.3 在运行详情与消息通道中记录降级原因、后端切换与恢复建议（`getDiagnostics` SLO 摘要；UI 文案仍简）

## 3. Package 信任治理

- [ ] 3.1 增加 Package 签名与来源校验流程，导入前 fail-closed 阻断
- [ ] 3.2 增加吊销列表校验并在运行前复核
- [ ] 3.3 增加可信发布者缓存与校验日志审计字段

## 4. 预算与 SLO 守卫

- [x] 4.1 扩展 Team/Workspace 级预算计量与阈值配置
- [x] 4.2 实现预算超限熔断与优先级豁免机制（基础 check/record；豁免机制仍简）
- [x] 4.3 输出运行 SLO 指标（成功率、超时率、恢复时延）并接入查询接口（launcher diagnostics）

## 5. 验证与放行

- [ ] 5.1 补齐 Daemon live E2E（token/need_input）稳定性用例与 evidence
- [ ] 5.2 增加故障注入测试（降级触发、签名失败、吊销命中、预算熔断）
- [x] 5.3 通过 `npm test`、`npm run lint`、`node .cursor/scripts/harness.js gate --json` 门禁（单元/定向测试；5.1/5.2 仍缺）
