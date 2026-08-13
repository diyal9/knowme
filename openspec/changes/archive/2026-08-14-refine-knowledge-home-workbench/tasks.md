## 1. 首页信息架构

- [x] 1.1 重构 `renderKnowledgeStatusWorkspace`：搜索框为首视觉中心，移除 Hero 标题与长说明
- [x] 1.2 紧凑次级动作（添加资料、检查问题、浏览全部、Obsidian）并保留现有 DOM id / IPC 绑定
- [x] 1.3 接入 `knowledgeRootIndexHtml` 目录树；待确认与健康状态弱化为小型信息

## 2. 样式与响应式

- [x] 2.1 新增/调整 `.knowledge-desk-*` 样式，遵循温暖灰白低边框语言，避免 SaaS Hero/大卡片
- [x] 2.2 510px 窄窗纵向堆叠且无水平溢出

## 3. 验证

- [x] 3.1 更新知识首页契约测试与命名测试
- [x] 3.2 新增 Electron smoke；运行 test、lint、OpenSpec strict validate、harness gate
- [x] 3.3 记录 `evidence/dev-self-test.md`
