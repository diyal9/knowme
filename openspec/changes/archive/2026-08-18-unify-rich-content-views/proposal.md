## Why

助理、知识网、工作台各自用不同的 Markdown 字符串或拷贝 CSS，飞书链接和 GFM 表格无法在全产品保持同一套观感。用户看到的是「这里有排版、那里是源码」，品牌不统一，也无法复用基线已有的飞书卡片/表格能力。

## 目标用户

日常在助理里读答复、在知识网读资料、在工作台看进度摘要的知识工作者。

## 验收标准

- 飞书文档/表格/妙记链接在助理气泡与知识阅读器呈现为同一套卡片（类型标记、标题、预览示意），不是裸 URL。
- GFM 管道表渲染为可横滑表格，样式与助理 `.agent-md` 表一致。
- 其他 Markdown（标题、列表、加粗）继续可用；不把 `**` 当纯文本。
- 新增表面用 `ContentView`，禁止再复制一份飞书卡片 HTML 字符串。

## 非目标（Non-goals）

- 不做完整 CommonMark / 不引入 marked 作为对话热路径。
- 不在本 change 重做飞书授权 CTA / 右侧预览窗（点击仍走 `<a href>`）。
- 不把管线服务旧 HTML 页全部迁完（可先接 React 面）。

## What Changes

- Domain 把 Markdown 解析成结构化块（含 table、feishu card 模型）。
- `src/renderer/features/content-view/` 提供 `ContentView`、`FeishuResourceCard`、`ContentTable` 与统一 CSS。
- 助理气泡、知识阅读器改用该组件。

## Capabilities

### New Capabilities

- `rich-content-view`：跨面统一的富内容块视图（飞书卡片、表格、通用 Markdown）。

### Modified Capabilities

- `agent-chat-ux`：助手正文改走 ContentView。

## Impact

- `src/domain/content-*.ts`、`src/lib/feishu-link.ts`（具名导出）、`src/renderer/features/content-view/`、助理与知识阅读器
- 测试：domain 解析单测 + content-view / assistant spec
