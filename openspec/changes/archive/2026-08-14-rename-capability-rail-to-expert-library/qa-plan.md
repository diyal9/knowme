# QA Plan — rename-capability-rail-to-expert-library

## Smoke Scope

- 左侧 rail「专家库」可点击并打开统一 Hub
- Hub 顶栏标题为「专家库」，Tab 仍为专家 / 技能 / MCP 连接器
- 工作台「去专家库…」类 CTA 文案正确
- 设置页迁移引导指向「专家库」

## Cases

| ID | 步骤 | 期望 |
|----|------|------|
| S1 | 查看左侧 rail | 标签为「专家库」 |
| S2 | 点击专家库 | 打开 Hub，默认专家 Tab |
| S3 | 查看 Hub 顶栏 / drawer 标题 | 显示「专家库」，无「能力 Hub」 |
| S4 | 工作台空态/快捷任务 CTA | 使用「专家库」 |
| S5 | 设置 → 打开专家库 | 引导文案与按钮指向专家库 |

## Anti-patterns

- 同一产品面混用「能力 Hub / 能力界面 / 专家库」
- 误改「添加能力」条目按钮或代码 id
