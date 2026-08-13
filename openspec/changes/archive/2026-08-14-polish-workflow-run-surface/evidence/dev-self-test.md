# Dev self-test — polish-workflow-run-surface

## Changes

- 确认输入卡片：阶段徽章 +「填写本次信息」指引；不再复写顶栏工作流名/产出。
- 字段：必填徽章；移除 schema type 展示（如 `text`）。
- 元信息：参与专家 chips（可解析 nodes 时）+「执行方式：本机专家团队（系统自动选择）」。
- 视觉：顶栏/步进/卡片/字段焦点/主按钮与货架 token 对齐。

## Checks

| 项 | 结果 |
|---|---|
| `npm run lint` | pass |
| `tests/workbench-templates.test.js` three-stage flow | pass（整仓 1661/1662；失败项为 `workspace-agent` composer remeasure，与本次无关） |

## Manual smoke

重启应用 → 工作台货架 → 任意可运行工作流「开始」：

1. 顶栏有工作流名与「产出：…」；卡片仅「确认输入 / 填写本次信息」与表单
2. 必填项有「必填」徽章，无 `text` 字样
3. 底栏只读执行方式为中文产品文案
4. 开始运行 / 取消 / 返回货架行为与改前一致
