## Why

从严口径当前 89，目标 96。体验/性能要对照证据才能到 15；架构要把 AppShell 表面加载挪走；类型去掉 `any`；OpenSpec 归档已勾完项；清掉 `.tmp-*`。

## What Changes

- 性能：首屏字节对照 `f6ad048` + 100 条消息虚拟列表单测，写入 evidence
- 体验：对照基线截图走助理主路径；归档已勾完的 restore-assistant-*
- 架构：`surface-registry` 拥有懒加载；AppShell 只路由
- 类型：`lazySurface<P>` 去掉 `any`
- OpenSpec：归档任务已全勾且无诚实缺口的 change
- 债：删除仓库根 `.tmp-*`

## Capabilities

### New Capabilities

- `strict-score-evidence`: 对照测量与表面注册表

### Modified Capabilities

- （无新用户面）

## Impact

- AppShell / 测试 / openspec/changes 活跃集
- 非目标：不恢复便签编辑器；不把 Playwright 塞进 `npm run check`
