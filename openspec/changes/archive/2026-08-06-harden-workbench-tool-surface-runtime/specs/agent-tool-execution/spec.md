## ADDED Requirements

### Requirement: Test-only injection seam for fake apply

生产环境 MUST NOT 允许渲染进程 IPC payload 携带 `fakeApply` 或任意测试开关。fake 外部写测试 MUST 通过主进程 test-only seam（如 `KNOWME_TEST_SEAM=1` 或测试模块注入 opts）启用。

#### Scenario: Renderer fakeApply stripped

- **WHEN** 渲染进程 IPC 传入 `{ fakeApply: true }`
- **THEN** 主进程 MUST 忽略该字段
- **AND** apply 行为与生产一致（需真实凭据或返回 scope 错误）

#### Scenario: Test seam enables fake apply

- **WHEN** `KNOWME_TEST_SEAM=1` 且 node 单测调用 apply
- **THEN** MAY 使用 fake apply 且不发起真实外部 API
- **AND** audit 仍写入且标记 `testSeam=true`

### Requirement: Runtime store eviction for artifacts and processes

artifact 与 process 内存 registry MUST 实施 TTL 与容量上限；超限时 LRU 淘汰。`task_status` / artifact 查询对过期 id MUST 返回 `expired` 或等价可读码。

#### Scenario: Process registry TTL

- **WHEN** 进程记录超过 24h
- **THEN** `task_status` 返回 expired 说明
- **AND** MUST NOT 返回伪造 running 状态

#### Scenario: Artifact store cap

- **WHEN** artifactStore 超过 200 条
- **THEN** 最旧条目被淘汰
- **AND** 查询被淘汰 id 返回友好 not_found

## MODIFIED Requirements

### Requirement: Injectable ports for LLM tools and context

执行内核 MUST 通过端口（ports）访问 LLM、工具执行、上下文构建、会话持久化与设置；MUST NOT 在内核内直接调用全局 `fetch` 或读写 `%APPDATA%` 路径。工具端口 MUST 使用 Registry 唯一 resolver 组装的 tool surface，而非 ad-hoc `createToolSurface`。

#### Scenario: Mock tool executor in unit test

- **WHEN** 测试注入按 fixture 返回结果的 mock 工具端口
- **THEN** 工具阶段结果与 fixture 一致且计入 trace

#### Scenario: Production uses registry resolver

- **WHEN** v1 模式下 Run 执行工具
- **THEN** 工具端口 MUST 来自 Registry-backed surface
