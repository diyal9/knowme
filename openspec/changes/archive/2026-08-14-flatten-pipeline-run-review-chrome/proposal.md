## Why

管线运行右栏（审阅面）相对「项目配置」侧栏显得层次过深：米色渐变底 + 多套嵌套卡片、`team-run` 等标题重复、字号字重过多；「代码工作区」仍弹出「未接入 API」占位提示，破坏可信度。

目标用户：在右栏审阅管线失败/进行中结果、需要快速扫读步骤与制品的知识工作者。

商业化与体验价值：右栏与工作台其余表面（如项目配置）视觉一致，降低「半成品工具」感，失败态可读、可行动。

## What Changes

- 压平运行/审阅右栏视觉：去掉深色/米色渐变嵌套感，对齐项目配置侧栏的白底浅边卡片层次。
- 标题只保留顶栏一处工作流名 + Outcome Pill；隐藏 daemon 审阅态下的 runner 副标题与「审阅 制品」大标题重复。
- 收敛字号字重阶梯（对齐侧栏 panel head / body 尺度）。
- 「代码工作区」：有可打开本地路径（制品/上下文）时真实打开；否则隐藏或禁用，**禁止**「后续接入 API」占位 toast。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：审阅右栏信息层级、标题唯一性与代码工作区入口诚实行为。

## 验收标准

- 运行右栏背景与项目配置侧栏同属浅色扁平体系，不再有明显「深米色壳套白卡」的三层以上装饰嵌套。
- 顶栏工作流名不在副行 / runner head / 审阅标题再次原样重复。
- 审阅区内主要正文字号不超过 2～3 档。
- 点击「代码工作区」不会出现「后续接入 API」类占位提示；无路径时按钮不可用或隐藏。
- 相关静态契约 / 单测通过。

## 非目标（Non-goals）

- 不新做 Daemon Workspace 远程 API。
- 不改左栏过程对话协议与轮询。
- 不重做确认输入表单阶段。

## Impact

- `src/workspace.html`、`src/workbench-shelf.css`、`src/workbench-layout.css`、`src/workbench.js`
- 必要时 `tests/workbench-templates.test.js` / `tests/workbench-daemon-review.test.js`
