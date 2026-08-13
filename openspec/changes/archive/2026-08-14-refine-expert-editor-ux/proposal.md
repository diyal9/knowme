## Why

专家编辑弹窗已经能完成配置，但对照真实使用仍有几处会打断心流：AgenticType 下拉选项挤成一块、Agentic 复选框被表单控件样式撑成大方块、头像网格占两行还带着「按名称匹配」说明、Skills 长列表把表单撑得又窄又长。需要把编辑界面做成更大、更精致、可一次看清身份与模式的工作台，而不是一份滚动表单。

### 目标用户

- 在能力 Hub 新建、编辑或复制专家的 KnowMe 使用者。

### 验收标准

- AgenticType 下拉选项之间有可见横线分割。
- 头像为单行横向滚动；无「按名称匹配」按钮与说明文案；新建专家默认选中自动匹配头像。
- Agentic 模式附属 checkbox 与文字同一行水平对齐，不再出现大方块叠在文字上方。
- Skills（及同类目录）选择封装为可复用组件，在弹窗中完成勾选；未安装时引导「先安装技能，再选择」。
- 编辑弹窗明显大于改造前，分区留白与 KnowMe 暖灰/圆角语言一致，无横向溢出。

### 非目标（Non-goals）

- 不改专家保存、IPC、Agent Profile 协议与 avatar 字段语义。
- 不新增头像资源、不引入用户上传。
- 不改造导入弹窗与专家详情抽屉。
- 不新增前端依赖。

## What Changes

- 放大专家编辑弹窗，收紧分区节奏与表单控件对齐。
- AgenticType 改为带选项分隔线的自定义下拉（保留隐藏值以兼容现有读取）。
- 修复 Agentic 附属 checkbox 排版：复用卡片勾选视觉，文字与勾选框同行。
- 头像选择器改为单行横滑；去掉自动匹配按钮与说明；创建时仍按名称/职责/Skill 默认匹配，用户点选后停止自动改选。
- 将目录多选抽成可复用 Catalog Picker；专家编辑中 Skills / Tool / 知识库以摘要条打开二级弹窗选择。
- Skills 空态文案改为「先安装技能，再选择」，并提供跳转到技能页的入口。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `capability-hub`: 专家编辑弹窗的尺寸、头像横滑、AgenticType 分隔、Agentic checkbox 排版，以及 Skills 等目录选择改为可复用弹窗组件。

## Impact

- `src/capability-hub.js` / `src/capability-hub.css` / `src/capability-hub.html`
- 新增 `src/lib/catalog-picker.js`（及对应单测）
- 扩展 `tests/capability-hub.test.js`
- 不改主进程、preload、用户数据形状
