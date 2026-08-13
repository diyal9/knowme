# Dev self-test — redesign-expert-workflow-node-canvas

Date: 2026-08-11

## Scope

1. 专业节点画布（第一轮）
2. 自由端口连线 + llm/tool/knowledge/condition（第二轮，「都要做」）

## Commands

```bash
node --test tests/workbench-studio-canvas.test.js tests/workbench-studio-model.test.js tests/workbench-studio-free-graph.test.js
npm test
npm run lint
```

## Results

- free graph：边 upsert / specialty 编译 / validate / fromGraph 还原
- canvas + linear model 单测
- 模板契约 CSS 版本与当前 HTML 对齐（layout v=6, console v=5）

## Manual checklist

1. 工作台 → 编排工作流：专业画布，开始/结束，格子底板
2. 调色板添加 大模型 / 工具 / 知识库 / 条件；从端口拖线；条件真假端口
3. 节点可拖动；选中边 Delete 删除
4. Inspector 绑定专家；工具选 Skill；保存时无绑定应 toast 错误
5. 「轻量步骤」可回退列表
