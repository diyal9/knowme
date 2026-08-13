## Why

KnowMe 对外将根 llmwiki 与若干专业知识库织成的整体能力称为「知识网」，Slogan 为「KnowMe 懂你的知识网」。当前左侧菜单与知识中心顶层仍显示「知识库」，与 roadmap §1.5 命名单一事实源不一致，易与个体「知识库 / llmwiki」混淆。

目标用户：通过左侧 rail 进入知识中心、需要理解「整体知识织网」与「单个库」区别的桌面用户。

体验价值：菜单与顶层定位语准确传达产品心智（知识网 = 整体；知识库 = 个体单元），不牵动 AI 提示词与后端标识。

## What Changes

- 左侧 rail `btnKnowledgeOs` 可见文案：`title`、`aria-label`、`.rail-label` 由「知识库」改为「知识网」。
- 知识中心打开时的顶层标题（center surface drawer title）改为「知识网」。
- 知识中心整体定位语更新为体现「懂你的知识网」（welcome kicker、Obsidian 交接边界 KnowMe 侧描述）。
- 打开成功 toast 改为「知识网已打开」。
- 新增静态断言测试与 Electron 冒烟，验证 rail 文案与个体库用词边界。

验收标准：

- 左侧 rail 按钮显示「知识网」，点击可正常打开知识中心。
- 知识中心顶层标题/定位语体现「知识网 / 懂你的知识网」。
- 「本地知识库」「添加知识库」「根知识库」等个体库文案未变。
- AI 提示词、飞书专有名词、代码标识符未变。
- `npm test` / `npm run lint` 无本 change 新增失败；冒烟无本 change 新增控制台 error。

非目标（Non-goals）：

- 不改个体库用词（根/本地/专业知识库、添加知识库、AI 检索源、llmwiki）。
- 不改 AI 提示词 / grounding / 意图识别中的「知识库」。
- 不改第三方专有名词「飞书知识库」及 `feishu-*` 文件。
- 不改代码标识符、模块名、目录名、IPC channel（含 `btnKnowledgeOs` id）。
- 不修复并行 workbench 重构、`pageerror: Identifier 'api' has already been declared` 等既有债务。
- 不改聊天空态「查文档/知识库」等个体/泛指引用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`：左侧 rail 与知识中心顶层用户可见命名对齐「知识网」术语。

## Impact

- `src/workspace.html`：rail 按钮可见文案。
- `src/workspace.js`：知识中心打开标题、顶层定位语、成功 toast。
- `tests/knowledge-web-naming.test.js`、`tests/agent-rail-quick-entry.test.js`：命名边界回归。
- 不新增依赖，不改 IPC。
