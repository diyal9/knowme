# Retro: knowledge-fullpage-stack

日期：2026-07-22

## 做了什么

- 知识库从右侧 380px 抽屉改为 `mode-knowledge` 全页单列堆叠
- 版本对比 / 最终提示词保留窄抽屉；关闭路径：关按钮 / 再点书本 / Agent

## 学到什么

- ribbon 模块若与 Agent「对等」，入口应切整页，而不是再叠一栏抽屉
- `openDrawer(title, { fullpage })` 区分模块页与工具抽屉，避免一刀切

## 可升格

- 工作台模块切换清单（rail 模块 = 全页；工具面板 = 窄抽屉）— 若再复发 ≥3 再 `/evolve`
