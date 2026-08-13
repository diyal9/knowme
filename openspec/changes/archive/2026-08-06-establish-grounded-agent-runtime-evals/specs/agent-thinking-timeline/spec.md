## ADDED Requirements

### Requirement: Timeline shows evidence and verification status

执行过程时间线 MUST 展示工具/evidence 状态：ok、fail、empty、truncated、blocked，并提供来源 provenance 入口（工具名、refId、evidenceId）。MUST NOT 在 ledger 无 ok 证据时将工具步骤显示为已成功读取。

#### Scenario: Truncated tool shows truncated badge

- **WHEN** tool result 被标记 truncated
- **THEN** 时间线该步骤 MUST 显示 truncated 状态
- **AND** 默认摘要 MUST NOT 写「已读取全文」

#### Scenario: Blocked verify shows blocked step

- **WHEN** ClaimVerifier 拦截最终输出
- **THEN** 时间线 MUST 增加 blocked/核对依据 步骤
- **AND** 用户可查看 blocked 原因摘要

#### Scenario: Provenance expand preserves streaming behavior

- **WHEN** 用户展开某 evidence 来源详情
- **THEN** 须符合既有「流式增量更新、不重建整树」要求
- **AND** 展开状态保持

### Requirement: Grounding status stream metadata

Stage/tool 事件 MUST 可携带 grounding-status 元数据（status、sources、claims），供时间线渲染；C 端 title/summary 文案 MUST 保持中性诚实，不得虚假「已读取」。

#### Scenario: Emit grounding status on verify

- **WHEN** VERIFY_CLAIMS 完成
- **THEN** emit MUST 含 grounding-status verified|blocked|failed
- **AND** 机器字段 MUST NOT 改变用户 Markdown 正文结构
