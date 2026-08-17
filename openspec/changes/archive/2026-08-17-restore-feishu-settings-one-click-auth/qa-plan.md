# QA Plan：restore-feishu-settings-one-click-auth

## Smoke Scope

- [x] 设置 → 连接器：未连接显示「一键授权」
- [x] 点击一键授权 → 权限确认 → 确认并授权（mock 流程）
- [x] 全就绪后主按钮「已连接」且 disabled
- [x] 空连接器列表文案为「暂无其他连接器。」
- [x] 高级设置折叠可展开（caret 可见）

## 反模式

- [x] 未连接却显示「补充权限」作为主按钮 — 不得出现
- [x] 全就绪仍可点主按钮反复授权 — 不得出现
- [x] 状态判定写死在 JSX 多分支 — 不得出现（须走 `buildFeishuCardModel`）

## 回归

- [x] 公司 MCP 表单仍可保存
- [x] Workbench 授权区块仍渲染
