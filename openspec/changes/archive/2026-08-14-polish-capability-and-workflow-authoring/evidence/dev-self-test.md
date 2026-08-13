# 开发自测 — polish-capability-and-workflow-authoring

日期：2026-08-11 · 角色：开发

## 自动化

| 项目 | 命令 | 结果 |
|---|---|---|
| 单元 / 契约测试 | `npm test` | 1585 passed / 0 failed |
| Lint + script scope | `npm run lint` | lint ok · script-scope ok |
| 桌面冒烟 | `node openspec/changes/polish-capability-and-workflow-authoring/evidence/ux-polish-desktop-smoke.js` | 10/10 PASS · 无渲染进程 console error |

新增静态契约：`tests/polish-capability-and-workflow-authoring.test.js`（10 条），覆盖应用内确认弹窗、技能任务与试用闭环、装配互链、编排技能配置、草稿拦截、键盘排序、窄窗检查器与死代码清理。

同步修正了两条按旧实现命名硬编码的断言：`tests/capability-hub.test.js` 的 `pendingWorkbenchAdds` → `pendingParentRequests`、`expertCapabilityPrepared` → `capabilityPrepared`；`tests/secondary-dialog.test.js` 不再钉死 `capability-hub.css?v=7` 版本号。

## 桌面冒烟明细

| 检查 | 结果 |
|---|---|
| hub-confirm-shell | PASS — 统一确认弹窗已就位 |
| hub-expert-composition | PASS — 专家详情展示装配的技能与连接器 |
| hub-skill-tasks | PASS — 技能详情展示「可以做什么」与试用入口 |
| studio-open | PASS |
| studio-skill-picker | PASS — 检查器内可直接配置技能 |
| studio-skill-written | PASS — 勾选后写入节点并回显数量 |
| studio-keyboard-reorder | PASS — `Alt+↓` 改顺序且焦点留在被移动的步骤 |
| studio-narrow-inspector | PASS — 1080px 下检查器仍可见 |
| studio-dirty-guard | PASS — 有未保存改动时返回先确认 |
| studio-dirty-discard | PASS — 放弃修改后离开编排 |

报告：`evidence/ux-polish-desktop-smoke.json` · 截图：`evidence/screenshots/`

## 冒烟中发现并修复的问题

1. 编排检查器把「本步骤技能」放在「高级选项」折叠区里，简易模式下等于隐藏了这次要打磨的核心配置 → 上移到「本步骤目标」下方。
2. 选中步骤后，「流程定义」整块仍占据检查器顶部，把步骤字段挤到折叠线以下 → 选中步骤时流程定义收为可展开条目。
3. 左侧「可用 Agent」列表条目未设 `min-width:0`，长描述把整行撑出面板，名称被挤到不可见 → 修正网格子项与按钮换行。
4. 技能列表在装了 38 项技能时只能在 168px 滚动框里翻找 → 超过 8 项时提供搜索过滤（已勾选项不会被过滤掉）。

## 已知限制

- 未安装的精选技能没有动态 task，任务区显示解释文案而非列表；安装后即可看到真实任务。
- 冒烟脚本使用临时 userDataDir 并复制真实 `settings.json`，不写入用户数据目录。
