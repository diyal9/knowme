# QA Plan: agentuniverse-style-workflow-cards

## Smoke Scope（必填）

- [ ] 打开工作台 → 编排工作流 → 专业画布
- [ ] 添加开始可见节点：开始/结束/专家/大模型 卡片有分节（输入/目标/Prompt 等）
- [ ] 选中节点 → 右侧属性可编辑；保存后刷新分节内容变化
- [ ] 端口拖线仍可连接；Delete 可删节点/边
- [ ] 轻量步骤模式切换不破损

## Regression Scope

- 自由图 ensureFreeGraph、校验失败 toast
- 条件双出口与分支边色
- 工作流测试运行入口

## Anti-pattern Checks

- 卡片信息过载到无法扫读（每节 >5 行仍不 ellipsize）
- 分节导致端口难拖、或 z-index 挡住连线
- 空白画布性能明显变差
