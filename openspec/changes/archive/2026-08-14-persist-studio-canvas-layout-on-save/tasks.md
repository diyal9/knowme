## 1. Persist layout through compile & package

- [x] 1.1 `workbench-agent-graph` 归一化保留节点 `x`/`y` 与顶层 `layout`
- [x] 1.2 `workflow-package` `normalizeGraph` 保留 `layout` 与节点 `x`/`y`（及 `studioKind`）

## 2. Save path

- [x] 2.1 `saveStudioWorkflow` 将 studio `toComposition` 的 layout/坐标合并进待存 graph
- [x] 2.2 保存后 `fromGraph` 能还原对齐后的坐标

## 3. Verification

- [x] 3.1 单测：layout round-trip（package normalize + fromGraph）
- [x] 3.2 `npm test` / `npm run lint`；`evidence/dev-self-test.md`；`qa-plan.md`
