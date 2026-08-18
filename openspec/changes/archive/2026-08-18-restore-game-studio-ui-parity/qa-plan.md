# QA Plan: restore-game-studio-ui-parity

对照提交：`f6ad048`（`feature/game-studio-work-partner`）。清单：`surfaces.md`。

## Smoke Scope（必填）

- [x] 应用启动 `npm start` 无崩溃、无 uncaught（本波以 `test:renderer` + Vite 预览截图代替真机；建议验收时再 `npm start`）
- [x] Rail：助理 / 工作台 / 专家库 / 管线 / 知识网 / 设置 均可到达（截图 `react-*.png` + hub/knowledge/settings specs）
- [x] 货架卡片可启动并进入任务房间（真实 daemon/launch，非假日志）（`run.spec.tsx` / Wave B）
- [x] 助理发送、Session 重启后仍在（`assistant.spec.tsx` persist + send）
- [x] 设置 7 Tab 可保存（`settings.spec.tsx` + `react-settings-*.png`）

## Regression Scope

- [ ] 工作台三 Tab 切换
- [ ] Studio 保存与返回来源（货架 vs 管理）
- [ ] 日志中心筛选/统计
- [ ] 无「新建便签 / 便签总览」入口
- [ ] 未绑定内容源时 `@` 不假装有文件

## Anti-pattern Checks（测试专用）

- [ ] 快速连点 Tab / 启动 / 保存
- [ ] 空搜索、超长工作流名
- [ ] Esc 关闭抽屉/弹层，蒙层点击关闭
- [ ] 杀进程后 session 与设置仍在

## 环境

- OS: Windows 10+
- 命令: npm start
- 基线: git show / checkout `f6ad048` 仅作对照，不作为运行交付
