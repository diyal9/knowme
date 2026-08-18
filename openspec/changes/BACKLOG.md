# OpenSpec BACKLOG（重构检查点收口 · 2026-08-18）

**活跃 change = 1**（`refactor-checkpoint-closeout` v0.4.0 收口；`harden-llm-call-and-prompt-assembly` 已 `.archived` 指向 archive）。

下面是**未交付**需求，下一轮用 `/opsx:propose` 单独立项。不要把归档当成已做完，也不要把本检查点再留成活跃 change。

文案/导航 rename 类归档、2026-08-01 空 tombstone、**2026-07 便签时代归档（15 个）** 均已删除。产品代码与 `openspec/specs/` 未动。

## 产品诚实缺口（原 restore-game-studio-ui-parity）

- 便签分屏 / 版本：非基线编辑器
- Electron 真机像素对照未制作人签字
- WB-auto 无 cron 表达式
- A-stream 无基线 progress 子块/动画
- A-tabs 新建仍在「更多」
- WB-search 全量
- Context Usage 无真实 token IPC
- knowledge provider 列表非 Hub provider IPC
- Studio 入出参 IO 未还原
- H-picker / Studio palette 密度 / A-tabs 右键 1:1

## 未开工 epic（原活跃 change，0 完成）

| 原 change | 摘要 |
|-----------|------|
| `align-assistant-avatar-with-brand-mark` | 助理面板头像与 `knowme-icon.svg` 几何对齐 |
| `harden-agent-runtime-resilience-and-governance` | RunManager 单轨、远端降级、包签名、预算熔断。未注册 backend 已 fail-closed，其余未做 |
| `improve-agent-package-onboarding-ux` | 导入预检面板、Guided Recovery。导入已有预检确认；Guided Recovery 接 store 的 cancelStage/recovery，动作按钮尚未接线 |
| `polish-code-workspace-cache-git-status` | 代码树 LRU/Git 色/MD·TS 预览。树内已有 LRU 下限修复（`maxBytes` 可 <1KB），Git 色与预览未做 |
| `workflow-dialogue-react-todos` | 工作流对话 To-dos（须按 React 表面重写，勿再改 workspace.html） |

## 已交付但仍薄的跟进

- Agent Graph：真模型多 Agent Run → gate → 重载（现有 smoke 只到提案确认）
- 管线首页 3 秒感知 / 离线失败文案真机
- 货架：任务房往返真机截图
- 任务房对话已禁止 `aiGenerate`（ack/clarify/gate）；专家房仍走 LLM

## 本轮已归档（实现收口）

见 `openspec/changes/archive/2026-08-18-*`。

**本树是重构检查点收尾，不是产品 1:1 完成。**
