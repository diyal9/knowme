# Agent 多阶段输出管线重构复盘

- 日期：2026-08-06
- Change：`refactor-agent-multistage-output-pipeline`
- 结论：开发自测、制作人验收、Tester QA、Harness gate 与独立复审全部通过，已归档。

## 有效做法

1. 用版本化多 lane 协议分离 progress/tool/answer/ui/terminal，消除正文双来源。
2. 工具轮 prose 先缓冲，post-process、grounding、output gate 完成后只提交 canonical answer。
3. Renderer 采用纯 reducer 与固定 DOM shell，answer、structured UI、timeline 只做局部 patch。
4. 受控 Electron fixture 通过独立 userData 验证真实 main → preload → renderer IPC，同时量测节点身份、滚动、JSON 泄漏和 terminal。
5. 独立复审以负例补出 terminal emit 异常、半截 bare thinking、structured UI 节点稳定等常规 happy-path 测试未覆盖的问题。

## 可复用约束

- terminal 状态只能在外部 emit 成功后冻结；发送失败时必须允许收敛为 `run.failed`。
- thinking/suggestion 清理必须覆盖 fenced、bare、单字段、非法和半截协议，同时保留普通公开 JSON。
- DOM 稳定门禁必须要求 before/after 节点都存在且严格同一，缺节点不能算通过。
- Electron fixture 必须显式启用测试 userData seam，不能因已有单实例静默降级后仍宣称 IPC 已验证。
- 截图采集不能改变滚动容器；使用 fixed clone 可兼顾视觉证据与 scroll-drift 量测。

## 后续建议

- 后续补充真实模型 + 真实写工具 pending_review 的批准/拒绝全链路冒烟。
- 增加 cancelled/failed 与超长 Markdown/表格/代码块组合的专用视觉基线。
