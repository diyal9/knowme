## Why

用户反馈“我的知识”首页宣传式标题与长段说明过多，Query/Ingest/Lint 运维术语压过真实任务；358 条待评估建议被做成主视觉，造成压迫感。产品方向已明确：用户只提供 raw 资料源，KnowMe 负责整理与检索；关系图谱交给 Obsidian，KnowMe 不做画布。

## What Changes

- 将常态首页重构为**搜索/提问优先**的安静个人资料工作台：首屏以搜索框为视觉中心，无 Hero 标题与长文案。
- 添加资料、检查问题、浏览全部、Obsidian 作为紧凑次级动作；图标可辅助但必须有中文标签。
- 保留真实目录树、最近更新与资料计数，弱化为小型状态信息，不做大卡片堆叠。
- 待确认数量改为简洁状态入口；资料空间异常时才突出警告。
- 默认首页不出现 Fabric、织网、authority、Query/Ingest/Lint/qmd 等内部术语；检索降级仍如实披露但不阻断使用。
- 复用现有搜索、添加、Lint、Obsidian、浏览深路由与 IPC；不删除 Fabric/治理兼容路径。

## Capabilities

### Modified Capabilities

- `knowledge-os`: 常态首页信息架构与待确认/健康状态呈现方式
- `workspace`: 知识首页布局、响应式与无障碍

## Impact

- 界面：`src/workspace.js`、`src/workspace.html`
- 测试：知识首页契约测试、Electron smoke
- 不新增依赖；不迁移用户数据
