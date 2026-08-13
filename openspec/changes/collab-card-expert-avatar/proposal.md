## Why

「你的协作」卡片左下角目前用通用人物线框图标，无法一眼识别对应专家；管理弹窗与快捷入口已有专家头像，卡片区不一致削弱身份感。

## What Changes

- 专家协作最近卡片左下角：用对应专家头像（`agentAvatarMark` / 预设图）替换通用 `users` 图标
- 无头像时回退语义图标（与管理弹窗一致）
- 工作流运行卡片仍用 workflow 图标（非专家协作场景）

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workbench-task-home-recent`：最近协作卡片页脚展示专家头像而非通用人物图标

## Impact

- `src/workbench.js`：`renderTaskRecentRow` 复用 `resolveTaskManageExpert` + `agentAvatarMark`
- `src/workbench-layout.css`：卡片 intent 区头像尺寸与裁切

## 目标用户

在工作台「专家协作」浏览最近协作并快速辨认专家的 C 端用户。

## 验收标准

- 有头像的专家（如办公伙伴）在卡片左下显示其头像图
- 文案仍为「专家名 · 相对时间」
- 无头像专家回退语义图标，不空白、不破版

## 非目标（Non-goals）

- 不改卡片标题/摘要/状态点布局
- 不改工作流 Tab 运行卡片的 workflow 图标策略
- 不新增任务持久化字段（头像仍从专家目录解析）
