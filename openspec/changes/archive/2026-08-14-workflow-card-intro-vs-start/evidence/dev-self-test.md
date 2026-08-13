# 开发自测 — workflow-card-intro-vs-start

日期：2026-08-12（纠偏）

## 变更摘要

- 货架卡片去掉绿色「开始」文字按钮
- 页脚改为右侧图标：play（开始任务）+ 编辑/复制
- **点卡片空白区 / Enter·Space → 居中详情**（`openWorkflowDetail`）
- **play 图标 → 直接确认输入**（`openWorkflowAsTask` / `beginWorkflowRun`）
- 详情内「开始运行」进入既有确认输入
- 去掉「清除筛选」文字按钮；领域 chip「全部」/ 清空搜索即可复位

## 命令

```text
node --test tests/workbench-templates.test.js
npm run lint
```

## 手工核对清单

- [x] 卡片页脚靠右，双图标风格一致
- [x] 点卡片空白打开详情介绍层，不直达确认输入
- [x] play 进入任务入参界面
- [x] 不可运行时 toast 提示，不切走货架
- [x] 编辑/复制仍各自触发
- [x] 筛选栏与空态均无「清除筛选」

## 结论

开发门禁（本 change 相关）通过；已按产品指正恢复「点卡片 → 详情」。
