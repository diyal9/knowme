## ADDED Requirements

### Requirement: Tool surface projection budget preserves required and connector tools

工具面投影 MUST 在预算内优先保留能力关键工具：taskFrame / 技能契约声明的必需工具（`requiredTools`）与已启用连接器投影出的工具 MUST 先于编排、子 Run 与低频内建工具入选。投影预算 MUST 足以容纳完整 v1 内建工具面加已启用连接器工具；当仍然超出预算时，系统 MUST 记录 warn 级日志并列出被裁剪的工具名，MUST NOT 静默丢弃。

#### Scenario: Connector tools survive a full builtin surface

- **GIVEN** 飞书连接器已启用且 allowlist 投影出 `feishu.doc_kb_suggest`
- **AND** 本轮已装配文件、进程、产物、编排、沙箱、计划、Web 与技能工具
- **WHEN** 系统投影本轮工具面
- **THEN** `feishu.doc_kb_suggest` 在工具面内且 `isAllowedTool` 返回 true
- **AND** 该连接器的其余 allowlist 工具同样可见

#### Scenario: Required tools outrank orchestration tools under budget pressure

- **GIVEN** taskFrame 声明 `requiredTools` 含某连接器工具
- **AND** 额外工具总数超出投影预算
- **WHEN** 系统投影本轮工具面
- **THEN** 必需工具入选
- **AND** 被裁剪的是编排 / 子 Run 等低优先级工具

#### Scenario: Truncation is observable

- **GIVEN** 额外工具总数超出投影预算
- **WHEN** 系统完成投影
- **THEN** 日志出现 warn 级记录，含被裁剪工具名与预算值
