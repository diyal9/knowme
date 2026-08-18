## Why

重构评分约 78；用户要求冲到 90。体验/性能已接近顶，需在技术债（巨 CSS）、架构收口、类型诚实、对话运行时再抬一截。

## What Changes

- 拆 `workspace-chrome.css`：壳 / 知识 / 助理分包，知识样式按路由懒加载
- 助理列表：更紧分页 + lazy ContentView；Context Usage「估算/会话用量」诚实标注
- 共享 `AgentContextInfo` 类型进 `api.ts`
- 复评目标：加权总分 ≥ 90

## Capabilities

### New Capabilities

- `refactor-score-lift`: 冲分到 90 的渲染债与类型诚实

### Modified Capabilities

- `renderer-runtime-perf`: 延续 CSS/对话运行时优化

## Impact

- 渲染 CSS 加载路径、assistant 气泡、api 类型
- 风险：知识面 FOUC（懒加载）
