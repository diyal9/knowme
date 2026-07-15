# QA Plan: fix-create-skill-drawer

## Smoke Scope（必填）

- [x] 设置 → 知识库 → 点「新建技能」→ 抽屉打开（非无反应）
- [x] 填写标题 + slash + 正文 → 创建成功 → 技能包列表出现
- [x] 编辑已有概念抽屉仍可保存；实例化按钮在新建态隐藏、编辑态可见

## Regression Scope

- 导出所选 / 导入 / 全选清空
- AI 助写 `/` 列表含新建技能

## Anti-pattern Checks

- 无 `window.prompt` 依赖
- 创建失败有 toast，不静默失败
