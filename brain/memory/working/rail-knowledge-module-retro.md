# Retro: rail-knowledge-module

日期：2026-07-21

## 做了什么

- 知识库入口提升到左侧 ribbon 底栏（与设置并列）
- 去掉 Agent 顶栏重复知识按钮与文件树 `side-foot`
- 下线片段库 UI + snippets IPC；保留 `listSkills` `/` 引用

## 学到什么

- KnowMe chrome 收敛原则：一模块一入口，避免文件栏脚注 + Agent 顶栏双入口
- 下线「片段库」时要区分 UI/IPC 与技能 `/` 能力，避免误删 `listSkills`

## 可升格

- UI chrome 入口去重 checklist（rail / side-foot / agent-head）— 若再复发 ≥3 再 `/evolve`
