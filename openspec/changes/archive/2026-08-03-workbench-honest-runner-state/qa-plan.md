# QA Plan: workbench-honest-runner-state

## Smoke Scope

- [x] degraded 场景（激活内容源无 team-run.json）：任务 done 时进度显示「无法确认进度」，无 100% / 无「已完成 1/1 步」
- [x] 顶部进度、当前状态、执行节点三处状态语义一致，无「执行中 + done + 加载失败」并存
- [x] 左侧助手下一步建议不出现「查看任务产物 ingest/brief.md」类输入路径
- [x] 正常任务（含真实 /artifacts 返回）：产物区仍正常展示且可点击打开
- [x] 点击相对路径产物：解析到激活仓库根后正确打开
- [x] 点击未产出产物：提示「尚未生成或未同步」，无系统级文件不存在报错
- [x] degraded 提示含「打开内容源设置」入口且可跳转

## 反模式检查（Tester）

- [x] 非 degraded 的正常线性/分支任务，进度百分比是否仍真实（不被本次改动误伤）
- [x] 输入路径与产物同名时（如产物真产出了 brief.md）是否会被误过滤（仅匹配 inputs 才过滤）
- [x] 相对路径解析是否拒绝目录穿越（`../`）与绝对路径注入
- [x] degraded 文案在暗/浅主题下可读性（浅色工作台默认可读；暗色无独立主题回归）
- [x] 窄栏（≤820px）下 degraded 出口按钮是否溢出（flex-wrap）
- [x] 助手脱敏是否过度（把用户真实需要看到的正常路径也抹掉）— 仅 looksInternal 触发

## 自动化

- `npm test`：progressSummary degraded 分支不返回 100%；artifact-open 相对路径解析与穿越拒绝；输入路径不入产物建议 — PASS
- `npm run lint` — PASS
