# RQA95 — 专家能力契约矩阵审计

日期：2026-09-08

## 目标

矩阵不能只检查旧版 `manifest.json` 和案例数量，还必须检查运行时真正消费的 v3 `capability.manifest.json`：依赖、交付物、路由、引用 Skill 和目录文件必须一致。

## 验证

命令：

```text
npm run eval:experts:matrix
```

6 个保留专家全部通过契约审计：

| 专家 | 能力依赖 | 交付物 | 路由 | 契约错误 |
|---|---:|---:|---:|---:|
| product-manager | 4 | 2 | 3 | 0 |
| office-partner | 9 | 1 | 9 | 0 |
| research-analyst | 5 | 2 | 6 | 0 |
| software-engineer | 4 | 2 | 3 | 0 |
| data-analyst | 6 | 2 | 3 | 0 |
| image-producer | 8 | 1 | 0 | 0 |

案例覆盖仍为 6/6 满足 normal、edge、retry、revision、reopen 的结构要求；这只证明可进入真实执行阶段，不代表 Provider、连接器或专业输出已经合格。

## 结论

该矩阵现在能发现能力契约层的缺项和漂移，但仍必须与 RQA94 的依赖审计、真实执行回执和独立专业评审联合使用。
