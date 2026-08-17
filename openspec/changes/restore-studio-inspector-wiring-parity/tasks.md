## 1. 属性契约

- [x] 1.1 StudioNode 暴露 profile / relation / approvalNote；技能读写 skillRefs
- [x] 1.2 条件 compare 四档；兼容旧 op
- [x] 1.3 简易模式 HITL；未选中隐藏右侧属性栏（对齐基线）
- [x] 1.4 流程定义仅开始（入参）/结束（出参）；业务节点无流程 IO  clutter

## 2. 连线串联

- [x] 2.1 条件端口连线带 branch + 标签
- [x] 2.2 连线默认 serial；属性可改 relation
- [x] 2.3 边上展示分支标签

## 3. 流程展示

- [x] 3.1 管理卡简要流程解析专家中文名；入出参缺省文案对齐基线

## 4. 测试

- [x] 4.1 studio.spec 技能 / 条件 / 选中后右侧属性 / 知识库无流程定义（16 pass）
- [x] 4.2 lint / typecheck:renderer