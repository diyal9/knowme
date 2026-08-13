# QA Plan: polish-task-composer-schedule

## Smoke Scope（必填）
- [ ] 「+ 新建任务」：目标为空；知识库紧凑；可开定时
- [ ] 开启每天定时 → 创建并开始 → 进入对话；任务卡有时钟标记
- [ ] 关闭定时创建 → 无计划字段启用

## Regression Scope
- 从已有任务再次安排仍预填目标
- 专家下拉简卡、创建并开始主路径

## Anti-pattern Checks
- 目标框是否仍出现无关历史文案
- 定时区是否默认展开造成噪音
- 知识库复选框是否再次被撑满整行
