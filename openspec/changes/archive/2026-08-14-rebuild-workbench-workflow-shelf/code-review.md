# Code Review — rebuild-workbench-workflow-shelf

审阅范围：本 change 的全部改动（供给管道、货架视图、运行视图、管理抽屉、违建清除）。

## 改动规模

「前」取本次改造开始时的工作副本状态（git HEAD 落后于工作副本很多，不能作为基线）。
「后」为当前可复现值。

| 指标 | 前 | 后 | 复现方式 |
|---|---|---|---|
| `src/workbench.js` 行数 | ~7200 | 5660 | `wc -l src/workbench.js` |
| `workbench.js` 函数数 | 241 | 218 | `node scripts/dead-code-scan.js` |
| 僵尸 DOM 绑定 | 31 | 0 | `node scripts/dead-dom-scan.js` |
| 无引用函数 | 23 | 0 | `node scripts/dead-code-scan.js` |
| 工作台一级 Tab | 5 | 0 | 冒烟 `legacy-entries-removed` |
| 启动入口 | 7 | 1 | 冒烟 `legacy-entries-removed` |

## 关键设计决定

**供给三段管道** — `src/lib/workflow-supply.js` 明确拆成收集 → 择优 → 排除，而不是原来的顺序
`seen` 去重。择优阶段按「可执行内容完整度」打分，所以 Daemon 与仓库同 id 时保留信息更全的一份，
而不是看谁先到。排除阶段每条都产出 `diagnostics`，这是空状态能说实话的前提——UI 不需要猜为什么没货。

**readiness 下沉到供给层** — `runnable` 与 `blockers[]` 在主进程算好随 `workbench-load` 下发，
渲染层只负责显示。避免渲染层各自判断导致卡片状态与汇总数字对不上。

**运行视图是接管式而非弹窗** — 三段式（确认输入 → 执行中 → 产物）用整块 `#wbRunSurface` 承载。
删掉旧启动弹窗后，确认输入阶段成为唯一确认点，`startWorkflowRun` 直接分派到
`beginLocalRun` / `beginDaemonRun`，中间不再插一层需要用户再点一次的模态。

## 已知偏差

`workbench.js` 未按 design 拆成 `workbench-shelf.js` / `workbench-run.js` / `workbench-manage.js`。
理由记在 `tasks.md` 第 2 节：本次已经是大范围行为变更 + 大量删除，再叠加文件搬迁会让回归定位困难。
渲染器拆分不影响任何用户可见行为，作为后续独立 change 处理。CSS 已按计划拆出 `workbench-shelf.css`。

## 审阅意见

**风险：供给层择优规则依赖打分启发式。** 若将来 Daemon 与仓库对同一 id 给出内容量相近但语义不同的
定义，择优可能选错。当前有 `diagnostics` 里的 `superseded` 记录可追溯，暂时可接受；如果真实出现
误选，应改为显式来源优先级配置而不是继续调分数。

**风险：`no-blocking-mask-during-run` 是回归护栏，不要删。** 本次最难定位的缺陷就是隐藏的
`#wbWorkflowModal` 全屏遮罩拦截所有点击，表现为冒烟测试在完全无关的位置超时。该检查用
`elementFromPoint` 直接验证运行期间没有遮罩，是这类问题唯一的早期信号。

**建议：`shelf-supply-probe.js` 应纳入常规回归。** 它用固定夹具跑供给管道，是唯一能稳定复现
「改造前后货架条目数」对比的手段，比依赖真实 Daemon 状态的冒烟更可靠。

**已确认无问题：** 删除的 DOM 与函数均有 `tests/workbench-templates.test.js` 的 `doesNotMatch`
断言护栏，防止后续改动把违建加回来；`surface-mapping.md` 逐行记录了每个被删 Tab 的能力落点，
没有能力在删除中丢失。

## 结论

通过。硬门禁全绿（`npm test` 1560/1560、`npm run lint` 无 error、Electron 实机 26/26、控制台 0 报错），
偏差已记录且不影响用户可见行为。
