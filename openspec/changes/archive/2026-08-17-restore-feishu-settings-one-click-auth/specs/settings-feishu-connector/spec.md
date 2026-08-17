## ADDED Requirements

### Requirement: Feishu settings card prefers one-click authorization

设置页飞书连接卡片 MUST 把未就绪用户的主操作呈现为「一键授权」；MUST NOT 在用户尚未连接时把主按钮标成「补充权限」。

#### Scenario: Disconnected user sees one-click auth

- **WHEN** 飞书未连接或 `userReady` 为假
- **THEN** 主按钮文案为「一键授权」且可点击
- **AND** 点击后展示权限确认，确认后启动 `connectorsFeishuAuthStart`

#### Scenario: Fully ready connection disables primary action

- **WHEN** 飞书已连接且权限齐全（`permissions.complete === true` 或无缺失分类）
- **THEN** 状态文案表明已可在对话中使用飞书
- **AND** 主按钮文案为「已连接」且 disabled

#### Scenario: Docs/wiki incomplete keeps one-click auth

- **WHEN** 账号已登录但文档/知识库能力未就绪
- **THEN** 状态文案说明文档/知识库权限未齐
- **AND** 主按钮仍为「一键授权」

### Requirement: Feishu card logic is encapsulated outside JSX

飞书卡片的状态文案与主按钮决策 MUST 由无 DOM 的纯函数产出，设置组件 MUST NOT 内联复制多分支就绪判定。

#### Scenario: View-model drives the card

- **WHEN** 渲染飞书连接卡片
- **THEN** 组件从封装函数读取 `statusText` / `primaryLabel` / `primaryDisabled`
- **AND** 同一函数可被单元测试覆盖各就绪分支
