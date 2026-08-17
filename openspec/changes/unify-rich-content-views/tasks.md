## 1. Domain

- [x] 1.1 `parseContentBlocks`：标题/列表/代码/引用/GFM 表/hr + 行内飞书卡片模型；单测
- [x] 1.2 `feishu-link.ts` 具名导出 `parseOpenLink`；`renderKnowledgeMarkdown` 改为 serialize 同一模型

## 2. UI

- [x] 2.1 `features/content-view`：`ContentView`、`FeishuResourceCard`、`ContentTable` + 统一 CSS
- [x] 2.2 助理气泡、知识阅读器改用 `ContentView`

## 3. 验证

- [x] 3.1 assistant / content-view / domain 单测；`npm run lint`；`typecheck:renderer`
