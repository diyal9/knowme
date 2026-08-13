# 开发自测报告

- 日期：2026-08-13
- Change：`refine-expert-editor-ux`
- npm test: **PARTIAL** — 本 change 相关 `tests/capability-hub.test.js` + `tests/catalog-picker.test.js` 18/18 PASS；全量 `npm test` 1875/1876，失败项为既有 `workbench-daemon-surface.test.js`（`statusLabel` 期望「待处理」实际「澄清」），与本次编辑器改动无关
- npm run lint: **PARTIAL** — `scripts/lint.js` 输出 `lint ok`；`check-script-scope.js` 因 `workspace.html` 顶层重名 `WAITING_STATES` / `ACTIVE_STATES`（`workbench-task-lifecycle.js` vs `workbench-daemon-surface.js`）失败，非本次文件引入
- 手动冒烟: 静态契约已覆盖；请制作人在能力 Hub 打开「添加自己的专家 / 编辑」做视觉验收
- OpenSpec：`openspec validate refine-expert-editor-ux --strict --type change` PASS

## 改动要点

- `src/lib/catalog-picker.js`：可复用目录多选（摘要 + 弹窗面板、搜索/全选/仅看已选）
- 专家编辑弹窗放大至 920px；头像单行横滑；去掉「按名称匹配」按钮，新建仍静默自动匹配
- AgenticType 自定义下拉，选项间横线分隔
- Agentic checkbox 改为 `.hub-flag` 同行对齐
- Skills / 连接器 / 知识库改为摘要条 + 二级选择弹窗；Skills 空态引导先安装再选择

## 手动验证点

- 打开 EXPERT 编辑：弹窗更大，无横向溢出
- 头像单行可横滑；无匹配按钮；新建默认已选中一张
- 打开 AgenticType：五项之间有横线
- ReAct 下「允许使用工具 / 允许反思修订」勾选框与文字同行
- 点「选择技能」打开二级弹窗，确认后摘要与底栏更新
- 无已安装 Skill 时看到「先安装再选择」与「去安装技能」
