# Code Review

结论（2026-09-05 复审）：撤回此前“未发现阻断发布的问题”的宽泛结论。真实测试发现并修复回执丢失、参考图传输、历史恢复、终态持久化及确认消息缺失；生图服务超时和模型专业判断仍须独立评估。以 `evidence/live-e2e-2026-09-05.md` 的实际证据和范围为准。

## 设计审查

- 通用 Profile 从 Manifest 读取执行策略、依赖、路由、交付和完成条件；具体专家只保留在 Agent 包和一次性历史迁移中。
- Provider adapter 以 `requiredTools + allowedConnectorIds` 能力相交投影，第三方专家可不改 KnowMe 接入同类工具。
- Artifact 是工具执行结果与 UI 预览之间的稳定契约；任务存储保留全部引用，不以模型文字推断“已生成”。
- 对话、运行状态、成果和验收分别建模，避免一个状态横幅或成果卡承担多种职责。

## 风险复核

- `validateExecutionCompletion` 为 CRITICAL 上游符号，本次没有修改；新增逻辑消费其通用验证结果。
- `mergeGroundingContracts` 为 HIGH 上游符号，仅扩展向后兼容的 Artifact 字段，原有调用语义未改变。
- `adaptLegacyCapability`、`loadExpert` 为 CRITICAL 上游符号，本次没有修改；22 个专家改用显式 Manifest，绕开新增 legacy 分支。
- 专家房和运行时新增的分支均有正常、异常、恢复与 UI 回归测试；无专家 ID 进入正常平台分支。

## 变更检测结论

- 2026-09-05 追加检测：全工作区 281 个已跟踪变更文件、512 个符号、158 条流程，整体 CRITICAL；包含大量既有并行修改和未索引新文件，不能据此宣称本次修改独立通过完整影响面审查。关键高风险符号在修改前分别分析，范围包括普通 Agent、专家任务、子执行及持久化，共享链路已跑全量自动化回归。

- 已执行 GitNexus `detect_changes(scope=all)`。当前工作区在本任务开始前已有多项并行改动，最终检测覆盖 279 个文件、504 个符号并给出 CRITICAL 总体风险；其中包含 Brain、Context Engine、项目上下文等与本 change 无关的改动，因此不能把该全仓等级归因到专家模块。
- 本 change 的关键符号均在编辑前做过 impact analysis；已知 HIGH/CRITICAL 上游符号按上述风险复核处理，没有忽略后直接修改。
- 已通过按 change 运行的 Story gate；所有硬门禁为 pass。专项测试和视觉证据见 `evidence/test-report.md`。
