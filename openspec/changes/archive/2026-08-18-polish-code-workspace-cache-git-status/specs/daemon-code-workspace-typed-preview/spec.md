## Purpose

按文件扩展名在代码工作区右侧美观展示内容：Markdown 排版预览，Go/TypeScript 等代码语法高亮，未知类型安全降级为纯文本。

## ADDED Requirements

### Requirement: 按文件类型分流预览

选择文本文件后，右侧预览 MUST 根据扩展名选择展示方式：Markdown 文档排版、受支持代码语言的语法高亮、或其他文本的纯文本视图。二进制文件 MUST 继续显示不可预览说明。渲染 MUST 防止 XSS（Markdown 消毒或代码转义）。

#### Scenario: Markdown 文档排版

- **WHEN** 用户打开扩展名为 `.md` 或 `.markdown` 的文件且内容为文本
- **THEN** 右侧以文档排版展示（至少可见标题/段落层级差异），MUST NOT 仅以未排版纯文本 dump 全文

#### Scenario: Go 代码语法高亮

- **WHEN** 用户打开 `.go` 文件且内容为文本
- **THEN** 右侧以等宽代码视图展示，并对关键字、字符串或注释等至少一类语法元素着色

#### Scenario: TypeScript 代码语法高亮

- **WHEN** 用户打开 `.ts` 或 `.tsx` 文件且内容为文本
- **THEN** 右侧以等宽代码视图展示，并对关键字、字符串或注释等至少一类语法元素着色

#### Scenario: 未知扩展名降级

- **WHEN** 用户打开未登记高亮语言的文本文件
- **THEN** 系统以转义后的纯文本预览，MUST NOT 注入未消毒 HTML

### Requirement: 语言标识

预览区 MUST 展示当前文件类型的可读标签（如 Markdown、Go、TypeScript），便于用户确认渲染模式。

#### Scenario: 打开 Go 文件可见语言标签

- **WHEN** 用户打开 `.go` 文件
- **THEN** 预览区可见 Go（或等价）语言标识
