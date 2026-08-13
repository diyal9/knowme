# Code Review — polish-capability-and-workflow-authoring

日期：2026-08-11 · 评审：开发自评

## 变更面

| 文件 | 变更 |
|---|---|
| `src/capability-hub.html` / `.css` / `.js` | 应用内确认弹窗、技能任务列表与试用入口、专家/技能装配互链、跨页跳转 |
| `src/workspace.html` / `workspace.js` / `workspace-agent.js` | `capability-hub-start-skill` 桥接与预填式会话入口，未保存草稿确认弹窗骨架 |
| `src/workbench.js` / `workbench-console.css` | 步骤技能选择器、草稿离开拦截、键盘排序、窄窗布局修复、死代码清理 |
| `tests/` | 新增契约测试；修正两处按旧命名硬编码的断言 |

## 关注点与结论

1. **iframe 消息边界**：`capability-hub-start-skill` 沿用既有 `isCapabilityHubSource` 校验，并对 `skillId` 做白名单正则；prompt/title 截断长度。与既有 expert 意图保持同一处理形状。
2. **失败可恢复**：试用链路中安装/启用成功但后续失败时，`capabilityPrepared` 分支会重新拉目录并重开抽屉，避免用户看到「装了却没装」的状态。原 `expertCapabilityPrepared` 更名以覆盖技能路径，同步更新了断言。
3. **不自动发送**：试用只预填 composer 并聚焦，不触发发送。任务提示词是模板，自动发送会产生用户没审阅过的请求。
4. **草稿安全**：`confirmLeaveStudio` 覆盖返回货架、切换工作流、切换顶层 Tab 三条出口；未 dirty 或空节点时不弹窗，避免噪声。
5. **键盘等价性**：`moveStudioNode` 是点击与键盘的唯一排序路径，边界由按钮 `disabled` 与索引校验双重兜底，不会像旧实现那样把越界移动记成一次 dirty。
6. **装配数据降级**：`loadCompositionIndex` 失败时只影响详情里的补充区块，目录与安装链路不受影响；未安装的精选能力显示解释文案而非空白。

## 遗留

- 未安装技能拿不到动态 task，任务区只能给解释文案；如果需要「安装前预览任务」，要由后端在 catalog item 上补 task 摘要，属另一次变更。
- 技能选择器目前平铺全部已启用技能（上限 60）并提供搜索；如果后续技能规模继续变大，需要分组或按 Agent 推荐排序。
