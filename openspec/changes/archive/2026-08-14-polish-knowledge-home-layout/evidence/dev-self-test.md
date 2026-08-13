# 开发自测

## 变更

`polish-knowledge-home-layout`

## 结果

- 知识首页专项测试：16/16 通过
- `npm test`：通过
- `npm run lint`：通过
- `npx openspec validate polish-knowledge-home-layout --strict`：通过
- Electron smoke：5/5 通过
- Electron smoke 控制台错误：0
- 窄窗口水平溢出：无

## 体验覆盖

- 搜索、添加资料、检查问题、浏览全部资料和 Obsidian 入口存在并保持原有绑定
- 资料目录成为主内容区域并填充可用高度
- 首页不渲染 Hero 标题、内部 Fabric/织网术语或图谱 Canvas
- 桌面与 510px 窄窗口均完成冒烟验证

## 备注

全量门禁硬项通过；Harness 仅报告其他活跃 change 的 advisory 工件缺失，不阻塞本变更。
