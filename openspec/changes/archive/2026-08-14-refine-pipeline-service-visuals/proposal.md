## Why

管线服务 Tab 信息架构已可用，但字号层级、控件圆角/边框/焦点态与主 CTA 配色仍偏离工作台货架与 `--wb-*` 令牌，看起来像「另一套灰黑表单」，降低专业感与信任。

## What Changes

- 字号与行高对齐工作台：标签 13px、正文输入 13px、右栏列表可读、连接条与刷新按钮垂直对齐。
- 控件样式对齐货架：`select` / `textarea` / 搜索框 / 次要按钮用 `--wb-line`、8px 圆角、accent focus ring。
- 主 CTA「开始开发」改用 `--wb-accent`（可用态）与表面灰（禁用态），去掉纯黑大圆角异色块。
- 状态色统一：成功/警告/危险用 `--wb-success` / `--wb-warning` / `--wb-danger` 与 soft 底色。
- 材料芯片与筛选 active 态改用 accent，不再用高饱和橙黄/纯黑描边。

### 目标用户

- 日常在工作台「管线服务」开工与回看记录的工程/制作同学。

### 验收标准

- 与「工作流」货架并排时，字号、边框、主按钮色无明显割裂。
- 连接条「已连接 / 刷新」基线对齐；右栏任务卡文字不再过密难读。
- 可用态「开始开发」为 accent 绿；禁用态为 muted 灰，不呈死黑。
- 不改交互逻辑与 Daemon 协议。

### 非目标（Non-goals）

- 不改三栏信息架构或 HTML 骨架大重构。
- 不改 Daemon HTTP / IPC / 开工校验规则。
- 不引入新字体或设计系统包。

### 商业化与体验价值

管线服务是远程算力入口；视觉与主产品一致可减少「半成品后台」感，提升首次开工完成率与付费算力信任。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-workbench`: 管线服务操作台视觉 MUST 复用工作台令牌与货架控件规范。

## Impact

- `src/workbench-console.css`（主）
- 必要时微调 `src/workbench-shelf.css` 中 daemon 布局对齐
- 不改 `workbench.js` 业务逻辑（除非仅为 class 微调）
