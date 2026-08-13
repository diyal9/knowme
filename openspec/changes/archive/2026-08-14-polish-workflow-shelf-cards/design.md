## Context

见 `proposal.md`。当前 `shelfCardHtml` 输出纯文字结构（标题 + 说明 + `dt/dd` 三行 meta + 页脚图标）；专家卡已有 `wb-my-agent-mark` 可对齐。纯渲染层改动，不跨 IPC。

## Goals / Non-Goals

**Goals:**

1. 卡片信息架构：图标井 + 标题行 + 说明 + chip meta + 可选阻塞一行 + 页脚。
2. CSS 字号/颜色层级与领域色标；对齐专家卡 mark 尺度。
3. 保持点击分区与启动/详情行为不变。

**Non-Goals:**

- 不改主进程供给、readiness 计算、详情弹层内容。
- 不新增图标字体依赖；复用 `data-icon="workflow"`。

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 图标 | 统一 `workflow` + `data-domain` 色调 | `office/engineering/visual` 图标未进 lucideSet；色标区分领域即可 |
| Meta | 横向 chips（输入 / 产出 / N 步） | 降低字墙，细节仍在详情层 |
| 说明 | 保留一句 `description`，2 行 clamp；若与产出文案完全相同则优先显示说明 | 避免 description 与产出重复两遍 |
| 阻塞 | `blocked` 类 + 左边色 + 一行 blocker | 诚实不可运行，不抢标题层级 |
| 边界 | 仅渲染进程 HTML/CSS | 无 IPC、无 schema |

## Risks / Trade-offs

- [chip 截断过狠看不懂] → title/aria 保留全文；详情层有完整 I/O
- [测试硬编码旧结构] → 同步更新 `workbench-templates.test.js`

## Migration Plan

热加载 / 重启 Electron 即可；无可回滚数据迁移。
