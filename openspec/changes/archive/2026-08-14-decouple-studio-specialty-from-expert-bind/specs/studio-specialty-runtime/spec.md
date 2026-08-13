## Purpose

定义专业画布上大模型 / 工具 / 知识库作为一等运行时节点的编译、校验与执行契约，使其不依赖 Agent Package，并与 Team Workflow Runner 的多类型分派对齐。

## ADDED Requirements

### Requirement: Specialty nodes compile as first-class runtime types

专业画布草稿中的 `llm`、`tool`、`knowledge` 节点 MUST 编译为 Team Workflow 中对应的 `type` 为 `llm` / `tool` / `knowledge` 的可执行节点，MUST NOT 仅为了执行而伪装成 `type: agent`。编译产物 MUST 携带该节点运行所需配置快照（模型与 Prompt、skillId、或 knowledgeId）。

#### Scenario: Compile llm without agent package

- **WHEN** 自由草稿仅含开始 → 已配置模型与 Prompt 的大模型节点 → 结束，且无专家节点
- **THEN** 编译结果 MUST 包含 `type: llm` 节点，MUST NOT 要求 `agentPackageId`，且校验 MUST 通过

#### Scenario: Compile tool and knowledge

- **WHEN** 草稿含已选 Skill 的工具节点与已选知识库的知识库节点
- **THEN** 编译结果 MUST 分别包含 `type: tool` 与 `type: knowledge` 节点，配置快照含对应 id

### Requirement: Team runner executes specialty node families

Team Workflow Runner MUST 能执行 `llm`、`tool`、`knowledge` 节点：大模型节点 MUST 使用所选模型与 Prompt（支持将上游结果代入输入）完成一次生成且 MUST NOT 进入完整 Agent 工具循环；工具节点 MUST 按声明的 Skill 做 fail-closed 单次执行；知识库节点 MUST 按声明的知识库执行检索并产出可传递给下游的文本摘要。任一类型失败时 MUST 以可理解错误码/摘要终止或按 join 策略处理，MUST NOT 回退为「缺少执行专家」。

#### Scenario: Run llm then tool graph

- **WHEN** 用户确认并启动仅含 `llm` → `tool`（无专家）的合法工作流
- **THEN** Runner MUST 先后执行两类节点，下游能消费上游摘要，且全程 MUST NOT 报 missing_agent / 需要绑定本地专家

#### Scenario: Workflow with only specialty members is startable

- **WHEN** composition 无 agent members 但含至少一个合法 specialty 节点
- **THEN** 系统 MUST 允许启动 Team Run（在其它治理校验通过的前提下）

### Requirement: Specialty execution stays on main process

Specialty 节点的模型调用、Skill 执行与知识检索 MUST 仅在主进程（或既有主进程托管服务）完成；Renderer MUST NOT 直接持有密钥或执行 Skill 脚本。

#### Scenario: Renderer cannot execute specialty locally

- **WHEN** 用户在编排画布点击测试运行
- **THEN** 实际执行 MUST 经由既有主进程 Run / IPC 路径，与专家 Agent 节点同一权威状态源
