# Retro: workbench-honest-runner-state

日期：2026-08-03

## 做了什么

修复任务工作间「假完成」体验：degraded 占位不再计入 100%；输入路径不再当产物推荐；相对产物路径解析到仓库根；失败给出内容源设置出口。

## 根因

1. `progressSummary` 把唯一 degraded 占位当成完成步
2. 任务事实/助手上下文未区分 `inputs` 与 Daemon artifacts
3. `openPath` 直接吃相对路径，未绑激活仓库根

## 教训

- 运行时面板的「成功态」必须与真实可交付物对齐，占位节点要显式标记并排除计数
- 注入给模型的上下文里，「输入」与「产物」必须分栏，否则模型会编「查看产物 ingest/…」
- 产物打开路径解析应复用 `resolveUnderRoot`，失败用产品文案而非 OS 报错

## 后续

- 真机 Daemon degraded 会话可再扫一眼（ADVISORY）
- 若同类假进度复发 ≥3，考虑升格为 `team-learned-honest-runner-progress` Skill
