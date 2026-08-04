# Tasks: workbench-honest-runner-state

## 1. 诚实进度（src/lib/workbench-task-projection.js + src/workbench.js）

- [x] 1.1 projection 的 degraded 占位节点标记 `degradedPlaceholder: true`（spec: Runner never fakes completion）
- [x] 1.2 `progressSummary()` 过滤占位节点；全为占位且 degraded → 返回「无法确认进度」，不再输出 100%（spec: Degraded graph shows unknown progress）
- [x] 1.3 顶部进度 / 当前状态 / 执行节点共享同一状态判定，消除三处矛盾（spec: Consistent status semantics）

## 2. 只展示真产物（src/lib/workbench-presenter.js + src/lib/workbench-task-brief.js + src/workspace-agent.js）

- [x] 2.1 `workbench-task-brief` 区分输入路径与产物，输入路径标注 `kind:'input'`（spec: Input path is not an artifact）
- [x] 2.2 左侧助手下一步建议排除输入路径，不再产出「查看产物 ingest/brief.md」类文案（spec: Input path is not an artifact）
- [x] 2.3 presenter 脱敏（`ingest/` 等内部路径）覆盖 chat 建议文案（spec: Presenter desensitization applies to chat suggestions）
- [x] 2.4 `#wbRunArtifacts` 仅渲染 `run.artifacts`（Daemon /artifacts 返回）（spec: Only real artifacts are surfaced）

## 3. 产物可打开（src/main.js + src/workbench.js）

- [x] 3.1 `workbench-daemon-artifact-open` 对相对路径先拒穿越再解析到激活仓库根（spec: Relative artifact path resolves to repo root）
- [x] 3.2 解析不到 / 未产出 → 返回 `{ ok:false, reason:'not-generated' }`，渲染层转「该产物尚未生成或未同步」友好提示（spec: Ungenerated artifact gives friendly hint）

## 4. 失败有出口（src/workbench.js renderTaskContext + src/workspace.html）

- [x] 4.1 degraded 分支文案用户化，说明「激活内容源可能与工作流不匹配」（spec: Actionable degraded hint）
- [x] 4.2 degraded 追加「打开内容源设置」行动按钮，复用现有设置跳转（spec: Load failure has an actionable exit）

## 5. 门禁（开发自测）

- [x] 5.1 新增/更新单测：progressSummary degraded 不返回 100%；artifact-open 相对路径解析；输入路径不入产物
- [x] 5.2 `npm test` 通过
- [x] 5.3 `npm run lint` 无 error
- [x] 5.4 写 evidence/dev-self-test.md
