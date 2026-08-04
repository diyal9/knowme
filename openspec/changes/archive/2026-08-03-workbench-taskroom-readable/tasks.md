# Tasks — 任务工作间右栏可读性优化

## 1. 纯函数：结论字段
- [x] 1.1 `workbench-task-brief.js`：`buildWorkbenchTaskBrief` 输出新增 `tone`（done/waiting/running/error/muted）与 `headline`（用户向单句结论）
- [x] 1.2 软化 degraded 默认文案，不含文件路径；保留既有 `factualBrief` 契约不变
- [x] 1.3 补单测：done/gate/clarification/failed/degraded 各自的 tone 与 headline

## 2. 纯函数：降级去黑话
- [x] 2.1 `workbench-task-projection.js`：`userFacingDegradedReason` 去掉 workflow id 与 `.cursor/workflows/` 路径，保留「激活内容源可能与该工作流不匹配」短语（测试依赖）

## 3. 渲染层
- [x] 3.1 `workbench.js` `renderTaskContext`：用「圆点 + headline + 一行说明」结构替代 `factualBrief` 文字墙；按 tone 给状态区与进度标签着色
- [x] 3.2 `renderDaemonRunner`：`done` 时 meta 显示「已完成」，降级时 meta 显示「流程详情暂不可用」，消除与进度矛盾
- [x] 3.3 「参与助手」降级提示简化为一句，不重复长原因

## 4. 样式
- [x] 4.1 `workspace.html` CSS：新增状态卡片与 tone 语义色；绿色仅保留给完成/成功；进度标签中性化

## 5. 门禁
- [x] 5.1 `npm test` 通过
- [x] 5.2 `npm run lint` 无 error
