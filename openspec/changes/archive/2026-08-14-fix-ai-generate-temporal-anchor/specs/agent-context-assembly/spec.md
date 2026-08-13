## ADDED Requirements

### Requirement: Local temporal anchor in dynamic context

`ai-generate` 在构建动态上下文时 MUST 注入基于本机时钟的时间锚点文本（含本地日期、星期、时间、时区与 ISO 时间，以及相对时间换算规则提示）。该注入 MUST 通过可加载模块完成，MUST NOT 依赖主进程入口文件的未导出局部函数；锚点解析失败 MUST NOT 以 `ReferenceError` 导致整轮生成失败。

#### Scenario: Expert chat greeting resolves without missing-symbol error

- **WHEN** 用户在工作台专家会话发送问候（如「你好」）
- **THEN** `ai-generate` MUST NOT 因 `buildTemporalAnchorContext is not defined` 失败
- **AND** 本轮动态上下文 MUST 包含本地时间锚点段落

#### Scenario: Temporal anchor text is deterministic for a fixed clock

- **WHEN** 以固定 `Date` 调用时间锚点构建函数
- **THEN** 返回文本 MUST 含该日期的本地日期、星期、时区名与对应 ISO 时间
