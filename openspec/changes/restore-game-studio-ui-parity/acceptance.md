# Acceptance — restore-game-studio-ui-parity

## 制作人清单

- [x] 对照 `f6ad048`，工作台/助理/专家库/设置观感一比一（图标、字号、间距、层级）— 证据：`evidence/screenshots/react/` vs `baseline/`；空态 composer 位置仍有差异，功能菜单已齐
- [x] 基线有的动作可走通（货架启动、任务房间、管线、Studio、会话、Hub 添加）— renderer specs 覆盖
- [x] 无独立便签窗
- [x] 实现仍是 React/TS feature，不是 LegacyHost

## 结论

- 结果：tasks 1.1–6.3 已勾选；开发门禁全绿；截图已入库。建议制作人 `npm start` 真机扫一眼空态 composer 位置。
- 日期：2026-08-15
