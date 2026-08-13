## 1. Draft model & validation

- [x] 1.1 拆分 `COMPILE_AS_AGENT`：仅 `agent` 强制 `agentPackageId`；`llm|tool|knowledge` 走专属必填（模型 / skill / knowledgeId）
- [x] 1.2 更新 `validateDraft` 空图与错误文案；去掉 specialty 的 `missing_agent`
- [x] 1.3 `compileFree` / `toComposition` 产出一等 `llm|tool|knowledge` 节点与配置快照；members 仅含真实专家
- [x] 1.4 单测：`workbench-studio-model` 覆盖无专家 llm 图通过、缺模型/缺 skill 失败、专家仍必绑

## 2. Graph 编译与 Runner

- [x] 2.1 `workbench-agent-graph` 允许无 agent members 但含 specialty 的 composition；packageRefs 不要求 specialty
- [x] 2.2 `AgentTeamWorkflowRunner` 增加 `llm|tool|knowledge` 执行分支（主进程 ports；llm 单次 complete，无工具循环）
- [x] 2.3 上游结果注入：`{{input}}` / 默认拼接上游 summary；结果形状对齐现有 nodeResults
- [x] 2.4 单测：runner / graph 覆盖纯 specialty 图可启动；失败码非 missing_agent

## 3. 画布 UI

- [x] 3.1 Inspector：llm/tool/knowledge 移除「执行专家」；llm 模型改为 Hub/catalog 下拉
- [x] 3.2 卡片 `fieldsFromNode`：移除 specialty 的 `select-expert`；同步调色板 hint 文案
- [x] 3.3 添加 specialty 时不再预填 `agentPackageId`；残留字段忽略且不阻保存
- [x] 3.4 单测或 UI 层断言：palette/fields 不含 specialty 专家必填

## 4. 自测与证据

- [x] 4.1 `npm test` / `npm run lint` 通过；更新相关 studio/runner 测试
- [x] 4.2 撰写 `evidence/dev-self-test.md`（含纯 llm 保存、试跑路径说明）
- [x] 4.3 Electron 冒烟：开始→大模型(Hub模型)→结束；工具/知识库无专家；专家节点回归仍必绑
