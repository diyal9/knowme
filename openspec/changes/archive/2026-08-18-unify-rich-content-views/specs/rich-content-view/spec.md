## ADDED Requirements

### Requirement: 飞书链接渲染为统一卡片

当正文中的 Markdown 链接或裸 URL 被识别为飞书资源时，视图 MUST 使用共享飞书卡片（类型字、标题、预览示意），MUST NOT 在助理与知识阅读器各写一套 HTML。会话（chat）类型可用紧凑打开链接。

#### Scenario: 飞书文档链接成卡片

- **WHEN** 助手或知识正文含 `[纪要](https://example.feishu.cn.com/docx/abc)` 或同类 feishu.cn 文档 URL
- **THEN** 出现飞书卡片，含文档类标签与标题「纪要」，看不到未处理的裸括号 Markdown

### Requirement: GFM 表格统一表格组件

管道表（表头 + `---` 分隔行）MUST 渲染为共享表格组件（可横滑），单元格内加粗/代码仍生效。

#### Scenario: 两列表

- **WHEN** 正文为 `| 项 | 状态 |\n| --- | --- |\n| **A** | `ok` |`
- **THEN** 可见 table，表头为「项」「状态」，单元格含粗体 A

### Requirement: 助理与知识网共用 ContentView

助理气泡与知识阅读器 MUST 使用同一 `ContentView`（或等价导出），列表/加粗与上列卡片/表格同一套样式类。

#### Scenario: 助理有序列表仍排版

- **WHEN** 助手正文为 `1. **Data Server Host**` 换行 `2. **Hit**`
- **THEN** 为有序列表且词条粗体
