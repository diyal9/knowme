## Why

编排工作室右上角「返回」写死切回工作流货架首页，但编辑/新建入口已迁到「管理工作流」。用户从管理页进入画布后点返回，会被扔回货架，打断维护闭环。

### 目标用户

在「管理工作流」里新建或编辑「我的」流程的日常用户。

### 商业化与体验价值

维护入口与返回目标不一致，会让「管理工作流」像半截功能：改完图却回不到列表，降低对个人流程治理的信任。

## What Changes

- 进入编排时记录来源面（管理工作流 / 工作流货架）。
- 右上角返回与「保存后离开」按来源恢复；默认回「管理工作流」。
- 返回按钮文案/无障碍标签改为「返回管理工作流」（来自货架时仍可标为返回工作流）。
- 更新既有「离开回货架」契约测试与 studio 相关 spec。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-composition-studio`：显式离开编排后须回到管理工作流（或进入时的货架来源），不得一律落到工作流首页。

## 验收标准

1. 管理工作流 → 编辑/新建 → 右上角返回 → 回到管理工作流列表。
2. 管理工作流 → 编辑 → 离开确认「保存后离开」→ 回到管理工作流。
3. 若从货架空态「新建工作流」进入 → 返回仍回货架。
4. 工具栏「保存」仍留在编排面（不回归旧踢出行为）。
5. `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改画布保存协议、节点校验或包结构。
- 不做多级浏览器历史栈。
- 不重做管理工作流列表 UI。

## Impact

- `src/workbench.js`：`openOrchestration` / `leaveStudioToShelf` / `syncHeadActionButton`
- 测试：`tests/keep-studio-after-toolbar-save.test.js` 及新增契约断言
- OpenSpec：`openspec/changes/fix-studio-back-to-workflow-manage/`
