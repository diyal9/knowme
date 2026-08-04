# Delta Spec: connector-feishu-auth

## ADDED Requirements

### Requirement: Feishu tool unavailability is explained precisely

系统 MUST 在飞书相关请求失败或未执行前，明确区分连接器未启用、未授权、allowlist 未放行和未读取正文证据四种状态。

#### Scenario: Connector disabled

- **GIVEN** 飞书连接器 `enabled !== true`
- **WHEN** 用户请求读取或润色飞书文档
- **THEN** 提示 MUST 指向“设置 -> 连接器 -> 启用飞书”
- **AND** MUST NOT 误写成“没有工具返回结果”

#### Scenario: User auth missing

- **GIVEN** 飞书连接器已启用但 `userReady === false`
- **WHEN** 用户请求读取或润色飞书文档
- **THEN** 提示 MUST 指向完成 user 授权
- **AND** MUST NOT 混淆为 allowlist 或正文证据问题

#### Scenario: Allowlist missing

- **GIVEN** 飞书连接器已启用且已授权
- **AND** 当前所需工具不在 allowlist
- **WHEN** 用户请求对应飞书能力
- **THEN** 提示 MUST 明确指出需要放行的工具名
- **AND** MUST NOT 指向重新授权

#### Scenario: Body evidence missing

- **GIVEN** 飞书工具已可用
- **AND** 当前轮次只有链接或搜索结果，还没有通过 `feishu.read_doc` / `feishu.get_wiki_node` 读取正文
- **WHEN** 用户要求总结、润色或改写正文
- **THEN** 系统 MUST 先继续读取正文
- **AND** 对用户说明当前缺的是正文证据，不是连接器或授权问题

### Requirement: Transient Feishu API failures stay human-readable

系统 MUST 将飞书服务端瞬时故障（如 `Internal error` / `Please retry` / `code: 1`）呈现为可读中文提示，不得把原始 JSON、`log_id` 或堆栈直接展示给用户。

#### Scenario: Internal error after retries

- **GIVEN** 飞书读工具或会议工作流调用返回服务端瞬时错误
- **WHEN** 自动重试仍失败，或模型未生成正文时由失败提示兜底
- **THEN** 用户可见文案 MUST 说明接口暂时故障并建议稍后重试
- **AND** MUST NOT 包含原始报错 JSON、`log_id` 或 `identity` 字段转储
