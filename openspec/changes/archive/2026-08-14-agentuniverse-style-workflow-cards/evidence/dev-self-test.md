# Dev self-test: agentuniverse-style-workflow-cards

日期：2026-08-12

## 变更点

- 专业画布节点 → agentUniverse 式分节富卡片（输入 / 模型 / Prompt / 输出等）
- 节点内轻量编辑：标题、入出参摘要、目标/Prompt、条件比较、技能/知识库选择
- 连线主色冷蓝 `#5b8def`；端口圆形描边
- Runtime / 编译路径未改

## 自动化

```text
node --test tests/workbench-studio-canvas.test.js tests/workbench-studio-free-graph.test.js tests/workbench-studio-model.test.js tests/compact-workflow-studio-canvas-ux.test.js
```

## 轻量编辑烟测

- [ ] 专业画布点节点标题可直接改名（不丢焦点）
- [ ] 大模型节点改 Prompt 后右侧属性同步（失焦后）
- [ ] 开始节点改入参标签 → 草稿 dirty
- [ ] 在输入框上拖拽不会拖走节点；头部可拖位
- [ ] 端口拖线不受输入框影响
