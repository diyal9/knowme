# Code review — unify-rich-content-views

结论：通过。助理气泡与知识阅读器共用 `ContentView`；飞书链接是卡片，GFM 表是真表格。管线旧 HTML 页未迁，属非目标。

- 单测：content-blocks / content-view / assistant
- 真机：Electron 种子消息含飞书 URL + 表 → `feishu-resource-card` / `content-table`
