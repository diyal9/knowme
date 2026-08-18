# QA Plan

## Smoke Scope

- [x] 知识库默认打开「AI 整理」而不是资料浏览。
- [x] 可选择新增/变更、全部资料或指定主题启动整理任务。
- [x] 任务状态显示进度、待审核数量、取消和重试入口。
- [x] 待审核提案显示来源路径、来源预览、目标路径、置信度和可编辑内容。
- [x] 接受提案后写入正式知识并刷新索引；拒绝/稍后处理不写入。
- [x] 体检问题可定位来源条目；资料浏览、知识源、Obsidian 保持辅助入口。

## Regression Scope

- `npm test`
- `npm run lint`
- OpenSpec strict validate
- 知识 OS、知识管家任务存储、提案工具和中心 Tab 单测
- Electron `npm start` 启动冒烟

## Anti-pattern Checks

- 不允许 Renderer 直接读写知识文件。
- 不允许未审核提案写入正式知识层。
- 不允许来源 hash 变化后静默覆盖新资料。
- 不允许 ingest 读取知识根和授权 Source 之外的路径。
- 不把空知识库渲染成不可操作的文件浏览死路。
