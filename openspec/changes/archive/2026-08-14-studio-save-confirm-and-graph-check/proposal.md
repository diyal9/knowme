## Why

工作室工具栏「保存 / 测试运行」与确认弹层职责混淆：测试运行会先保存再弹启动确认，弹层排版乱、目标被会话意图污染且不可改，「保存为我的工作流」游离在正文左下。用户需要：保存先确认再落盘；运行预览仅做 Graph 检查与动画，不真正执行。

## What Changes

- 画布「保存」：先弹出整洁确认弹层（可编辑工作流目标、多列协作节点、页脚统一按钮），确认后才真正保存
- 画布「测试运行」改为「检查流程」：仅走 Graph 检查标准 + 画布动画干跑，不落盘、不启动 Team Run
- 新增/扩展 Graph 检查机制（可达性、绑定、悬挂边、起终点等），问题节点即时高亮提示
- 弹层排版：多列节点网格、目标可编辑、操作按钮统一在页脚

## Capabilities

### New Capabilities

- `studio-graph-check`: 工作室画布 Graph 静态检查与动画预览
- `studio-save-confirm`: 工作室保存确认弹层

### Modified Capabilities

- （无强制修改既有主 spec；本变更以新 capability 描述行为）

## Impact

- `src/workbench.js`：保存/检查入口、弹层渲染与确认
- `src/lib/workbench-studio-model.js`：`inspectStudioGraph`
- `src/workbench-layout.css` / `src/workbench-console.css`：弹层与检查动画
- `tests/*`

## 目标用户

在工作室编排专家协作流程、需要保存与自检的创作者。

## 验收标准

1. 弹层排版整齐：分区清晰、节点 ≥2 列、页脚按钮成组
2. 目标为可编辑的工作流目标，不展示会话残留意图（如「三元礼包」）
3. 保存：点保存 → 弹层 → 确认后才落盘
4. 检查流程：只检查+动画，不启动运行；出错节点高亮并提示
5. `npm test` / `lint` 通过

## 非目标（Non-goals）

- 不在本变更中重做真正「启动 Team Run」的货架路径
- 不引入第三方图校验库
- 不做完整仿真执行（无 LLM/工具真实调用）
