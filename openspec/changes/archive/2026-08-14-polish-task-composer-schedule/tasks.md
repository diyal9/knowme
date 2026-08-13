## 1. Composer UI

- [x] 1.1 紧凑化任务知识库选项样式（padding/行高/列表间距），收缩弹窗留白
- [x] 1.2 新建弹窗增加可选定时区块（开关 + daily/interval/once 控件 + 在线提示）
- [x] 1.3 `openTaskComposer` 不再回填 `pendingGoal`；仅用显式 `goal`

## 2. Persist schedule on create

- [x] 2.1 `submitTaskComposer` / `beginExpertTask` 支持传入 schedule 字段并写入 create/update
- [x] 2.2 校验：once 开启时必须有时间；失败 toast

## 3. Verify

- [x] 3.1 补充/更新相关单测（源码契约或 store）
- [x] 3.2 `npm test` / `npm run lint`
- [x] 3.3 写入 qa-plan、acceptance、evidence
