## Context

See `proposal.md` — Why。当前专业画布 specialty（`llm|tool|knowledge`）在 `workbench-studio-model` 中属 `COMPILE_AS_AGENT`，保存强制 `agentPackageId`，编译后一律 `type: 'agent'`；`AgentTeamWorkflowRunner` 仅执行 `agent|condition|gate|join|terminal`。UI 已暴露「执行专家」，与「选 LLM Hub 模型」的产品语义冲突。

进程边界：Renderer 编辑草稿与校验提示；主进程持有 LLM / Skill / Knowledge 执行与 Team Runner；IPC 保持结构化 composition / team package，不把密钥或任意路径交给 Renderer。

## Goals / Non-Goals

**Goals:**

1. 草稿校验与 Inspector 按节点族区分必填项。
2. 编译产出一等 `llm|tool|knowledge` runtime 节点（保留 `studioKind` 兼容字段可选）。
3. Team Runner 为上述类型增加主进程侧 runner（fail-closed）。
4. LLM 模型选择绑定 `llm-model-catalog` / `llmModels` 已暴露目录。

**Non-Goals:**

- Daemon `script` 节点完整 parity
- 改 Agent 工具循环内核
- 在 Renderer 内直接调模型或跑 Skill

## Decisions

### 1. 拆分「可执行节点」集合

| 集合 | 成员 | 是否要 Package |
|------|------|----------------|
| `EXEC_AGENT` | `agent` | 是 |
| `EXEC_SPECIALTY` | `llm`, `tool`, `knowledge` | 否 |
| 控制 | `condition`, `join`, `gate`, `start`, `end` | 否 |

废弃对 specialty 使用 `COMPILE_AS_AGENT` 强制绑专家。`draftAgents()` 重命名语义为 `draftExecutableCapabilityNodes()`（或等价），空图判断改为「至少一个可执行能力节点」。

**备选**：继续伪装 agent + 隐藏专家字段并用系统 Package —— 否决：权限/快照/证据仍挂错载体，用户困惑不消失。

### 2. Runtime 节点类型与 Daemon 对齐思路

`compileFree` / composition 映射：

- `agent` → `type: 'agent'` + members 快照（现状）
- `llm` → `type: 'llm'` + `config: { model, temperature, prompt }`
- `tool` → `type: 'tool'` + `config: { skillId }`
- `knowledge` → `type: 'knowledge'` + `config: { knowledgeId, mode }`

`workbench-agent-graph`：允许 workflow **仅含 specialty、无 agent member**；`packageRefs` 仅收录真实 agent；specialty 写入 `capabilityRefs`（或节点内嵌 config 快照）供审计。

**备选**：specialty 仍编译为 agent，挂 `system/llm-runner` 伪 Package —— 可作为紧急回退，本 Story 默认不做。

### 3. Runner 实现位置

在 `AgentTeamWorkflowRunner` 主进程循环中，对 ready 的 `llm|tool|knowledge` 调用注入 ports：

- `llm`：`ports.llm.complete`（与 executor 同源），messages = system(prompt) + user(上游摘要/`{{input}}` 替换)；无工具循环。
- `tool`：经现有 Skill runtime / allowlist 执行单次 skill（缺权限 fail-closed）。
- `knowledge`：经现有知识检索入口返回文本摘要。

结果写入 `nodeResults`，形状与 agent 节点对齐（`ok/summary/artifactRefs/evidenceRefs`），便于下游 condition 与 UI。

**备选**：每 specialty 起 child AgentRun —— 过重，首版不做。

### 4. UI 模型选择

大模型节点 `config.modelName` 改为 `<select>`，选项来自 Renderer 已缓存的 `llmModels` / catalog（与设置页同源）。允许 `auto`。手填自定义模型 MAY 保留为高级项，但默认路径是 Hub 列表。

### 5. 历史草稿迁移

读取时：specialty 上残留的 `agentPackageId` 保留在对象但不参与校验；保存时可不写或清空。旧 composition 若仍含伪装 agent + studioKind，启动前归一化为新类型（normalize 一层），失败则明确报「请重新保存工作流」。

### 6. Electron / 性能

- 模型列表复用现有 IPC，不在每次选中节点时打外网。
- specialty runner 不创建完整 Agent Package 解析树，降低内存与启动成本。
- 并行度：`llm|tool|knowledge` 可与 agent 一样受 `parallelism` 批量限制（首版串行 specialty 亦可，实现时与 agentBatch 同策略）。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `workbench-agent-graph` 假设「至少一名 member」导致无专家图无法启动 | 放宽校验；空 members + 非空 specialty nodes 合法 |
| Tool 无专家上下文导致权限过宽 | 沿用全局/工作台 skill allowlist；无声明则拒绝 |
| Knowledge 检索无会话上下文 | 仅传上游文本 + knowledgeId；文档化限制 |
| 旧草稿试跑失败 | normalize + 友好错误；Smoke 覆盖迁移样例 |
| 与未归档 `surface-specialty-node-expert-bind` 冲突 | 本变更 supersede：specialty 卡片移除执行专家字段 |

## Migration Plan

1. 先改 model validate/compile + 单测（无 UI）。
2. Runner + graph 校验放宽 + 单测。
3. Inspector / 卡片 / Hub 选择器。
4. 手工冒烟：纯 llm 图、llm+tool、仅专家图回归。
5. 回滚：恢复 `COMPILE_AS_AGENT` 与 runner 分支即可；草稿向前兼容（多字段可忽略）。

## Open Questions

- Tool 节点是否允许「可选绑定专家以继承其 skill allowlist」作为高级选项？默认否；若验收中权限过死再加。
