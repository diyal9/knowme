## Cognition observer

- [x] 实现保守的本地对话候选提取与敏感/一次性过滤
- [x] 建立稳定 fingerprint、Evidence、Node、Claim 和 Proposal Effects
- [x] 接入个人 Agent 对话完成路径与明确教学路径

## Memory and governance

- [x] 将达到阈值的 Memory pattern 同步到统一待确认
- [x] 实现确认/拒绝状态回写、拒绝去重与重复观察计数
- [x] 确认前编辑同步更新实际提交 Effects
- [x] 确认后写 Growth Ledger，并保持撤销闭环

## Product surface

- [x] 增加待确认分类、证据与影响说明
- [x] 展示最近确认成长并提供撤销
- [x] 操作后即时刷新 Brain 图谱和统计

## Verification

- [x] Observer、Proposal、Memory bridge、编辑提交与撤销单元测试
- [x] 待确认 Renderer 交互测试
- [x] Playwright 真实闭环与截图
- [x] OpenSpec strict、制作人验收与测试 QA；全量质量门禁已执行，剩余 1 项非本变更的 Capability Hub 字体契约失败，详见 `test-report.md`
