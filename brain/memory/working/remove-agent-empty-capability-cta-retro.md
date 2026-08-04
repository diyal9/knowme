# remove-agent-empty-capability-cta Retro

## 结论

用户指出 Agent 空状态中的大型“打开能力 Hub”卡片不需要。已从首屏静态模板与动态重绘模板同步移除，并保留左侧统一能力入口。

## 有效做法

- 先检查主 spec，确认该 CTA 是显式产品契约而非单纯实现细节
- 对整条旧 requirement 使用 REMOVED + ADDED，避免归档时误保留已删除场景
- 静态契约测试同时读取 `workspace.html` 和 `workspace-agent.js`，覆盖初始与动态空状态
- Playwright 同时验证 CTA 消失和 rail 能力入口仍可用

## 证据

- 定向测试：33/33 PASS
- 全量测试：885/885 PASS
- lint：PASS
- 制作人验收：PASS
- 正式 QA：PASS
- Story gate：`ok=true`、`blocking=false`
- 归档：`2026-08-04-remove-agent-empty-capability-cta`
