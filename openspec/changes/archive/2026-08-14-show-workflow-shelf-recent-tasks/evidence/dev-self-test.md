# 开发自测: show-workflow-shelf-recent-tasks

## 命令

- `npm test` — 1727 pass / 0 fail
- `npm run lint` — ok

## 行为核对（代码）

- `#wbShelfRecentList` / `#wbShelfRecentEmpty` / `#wbShelfRecentToggle` 已挂在货架下方
- `#wbShelfGridToggle`：货架默认一行，`shelfRowCapacity()` 按栅格列数计算
- 默认折叠时 `.wb-body.is-shelf-home-locked` 禁止页面滚动；展开货架或任务「更多」后解锁
- `paintTaskRecentList` 仅渲染无 `workflowId` 任务
- 点击复用 `openTaskFromRecent`

## 待制作人验收

- 真机打开工作流 Tab：默认一行卡片 + 下方工作流任务，无需滑动；点「更多」后可滚动
