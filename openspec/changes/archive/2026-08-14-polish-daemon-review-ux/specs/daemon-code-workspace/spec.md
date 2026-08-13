## ADDED Requirements

### Requirement: 只读任务代码工作区

KnowMe MUST 提供与 Daemon WebUI 同构的只读代码工作区：按任务 slug 浏览 `workspace/tree` 与 `workspace/blob`。浏览器 MUST 支持根目录（仓）选择、目录展开、文件预览、刷新与关闭。

#### Scenario: 加载仓根

- **WHEN** 用户打开某任务的代码工作区
- **THEN** 系统请求 `/api/tasks/{slug}/workspace/tree` 根路径，并将返回的目录条目填充仓选择器

#### Scenario: 浏览文件

- **WHEN** 用户在树中点击文件
- **THEN** 系统请求对应 `workspace/blob` 并在右侧预览文本内容；二进制则显示不可预览说明

#### Scenario: 空仓或失败

- **WHEN** 工作区无代码仓目录或 API 失败
- **THEN** 界面显示诚实空态或错误文案，MUST NOT 假装已打开外部编辑器
