# 货架供给：改造前后对比

两组数据：`shelf-supply-probe.js` 用固定夹具跑供给管道（可复现），Electron 冒烟跑真实数据。

## 夹具对比（`node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-supply-probe.js`）

原始输出见 `shelf-supply-before-after.txt`。

| 场景 | 改造前条目 | 改造后条目 | 改造后可运行 | 关键差异 |
|---|---|---|---|---|
| Daemon 离线 | 5 | 4 | 2 | 仓库工作流 `team-run` 从 0 节点补成 6 节点 3 Agent；deprecated 的 `game-dev-delivery` 被排除并给出诊断 |
| Daemon 在线 | 7 | 5 | 3 | Daemon 的 `daily-summary` 进入货架；`internal-debug`（internal）被排除；同名 `team-run` 择优保留 repo 版本 |

改造前 5～7 条里 **没有一条**能判定可运行（`runnable` 全为 `null`），其中 2～4 条是 0 节点 0 Agent 的空壳。
改造后条目数变少，但每一条的状态都是真的：可运行的能点，不可运行的写清缺什么。

## 真实数据（Electron 冒烟，Daemon 在线）

`shelf-electron-smoke.json` → `shelf-has-cards`：

```
17 个工作流 · 15 个现在可以运行
```

## 排除规则命中的诊断

| code | 含义 | 货架呈现 |
|---|---|---|
| `hidden` | 目录可见性为 deprecated / internal | 不上架，空状态里列出原因 |
| `offline` | 执行服务未连接 | 空状态提示「连接后可解锁」，附 `connect-daemon` 操作 |
| `superseded` | 同 id 有更完整的定义 | 只保留完整的那一份 |
| `missing-agent` | 引用的 Agent 解析不到 | 上架但主操作禁用，卡片写明缺哪个 Agent |
