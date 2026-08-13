# QA Plan: simplify-studio-node-card-vs-inspector

## Smoke Scope（必填）

- [ ] 编排工作流：添加知识库节点 → 卡片无表单控件，显示专家/知识库摘要
- [ ] 选中该节点 → 右侧属性可改执行专家与知识库 → 卡片摘要同步
- [ ] 添加 llm / tool / agent / condition → 卡片只读摘要，编辑仅在属性面板
- [ ] 保存与测试运行校验仍 fail-closed（缺知识库/专家时拦截）
- [ ] 拖节点、连线、Delete 删除不受影响

## Regression Scope

- 轻量步骤模式未破坏
- 调色板新增 specialty 仍预填默认专家
- 开始/结束节点摘要仍正确

## Anti-pattern Checks（交给测试）

- 卡片与属性是否仍出现同一可编辑字段
- 未选中时是否误导用户以为必须在卡片上填表
- 摘要过长是否把卡片撑回臃肿
