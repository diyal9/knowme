# Retro: workbench-layout-polish

## 做了什么

- 修复 Ribbon 工作台图标：Lucide 24 path 误用 16 viewBox 导致裁切「残缺」
- 图标改为完整 layout-grid；相关图标入 lucideSet
- 工作台主体左右栏 → 上下分区（上 AgentTeams 网格 / 下工作流）

## 教训

- 新增 Lucide 图标必须同步加入 `lucideSet`，否则 24 坐标在 16 viewBox 下必裁切
- 窄操作区优先上下栈，避免固定宽侧栏挤扁

## 复发计数

- Lucide viewBox 混用：记 1 次（达 3 次可 `/evolve` 升 Skill）
