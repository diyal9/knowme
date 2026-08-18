## Why

编排页进入 Studio 后，工作台顶栏（`wb-head`）因模式 Tab 隐藏、标题默认 `display:none` 而几乎空白，返回与「编排工作流」却挤在下方二级条，浪费纵向空间，也不如 agentUniverse 等成熟画布「单顶栏导航」清楚。

## What Changes

- 将 Studio 的「编排工作流」标题迁入工作台顶栏左侧
- 返回统一使用顶栏右侧图标按钮（与任务间一致），去掉左侧文案「返回」避免双入口
- 顶栏可展示草稿保存态等轻量 meta（原 `wbStudioTopMeta`）
- 移除 Studio 内冗余二级 topbar，画布/组件/属性区结构保持不变
- 参考 agentUniverse 单层顶栏布局，不替换现有节点库、画布与 inspector 组件

## Impact

- Affected code: `src/workspace.html`, `src/workbench.js`, `src/workbench-shelf.css`, `src/workbench-console.css`（如需）
- Tests: 现有契约/冒烟；手工验证 Studio 进入/返回
