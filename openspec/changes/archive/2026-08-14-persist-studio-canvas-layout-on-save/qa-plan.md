# QA Plan — persist-studio-canvas-layout-on-save

## Smoke Scope

- [ ] 专业画布：一键对齐 → 保存 → 节点仍横排对齐，状态「已保存」
- [ ] 拖动某节点 → 保存 → 离开再编辑 → 位置仍在
- [ ] 无 layout 的旧「我的」工作流仍可打开

## Anti-patterns

- [ ] 保存后不得瞬间跳回堆叠/重叠布局
- [ ] 保存不得把用户踢回货架（与 keep-studio-after-toolbar-save 一致）
