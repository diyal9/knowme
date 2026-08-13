## Why

KnowMe 助理悬浮面板底部「日志中心 / 日志目录」目前是大块图标+文字双按钮，在已有「继续工作」主 CTA 的面板里显得过重，挤占视觉层级。用户只需次级入口，图标按钮即可。

## What Changes

- 将 `#km-fab-logs` / `#km-fab-logs-dir` 从「图标+文案」大方块改为紧凑**仅图标**按钮。
- 名称通过 `title` / `aria-label` 保留；点击行为与 IPC 不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`：助理快捷面板日志入口的呈现形态（图标按钮，文案不常驻）。

## 目标用户

- 日常展开 KnowMe 助理快捷面板、偶尔查看日志的知识工作者。

## 验收标准

- 面板底部仅显示两个小图标按钮，不再出现「日志中心」「日志目录」常驻文字。
- 悬停可见 tooltip；无障碍 `aria-label` 仍可读。
- 点击仍分别打开日志中心窗口 / 日志目录。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改助理头像、继续工作卡、铃铛入口。
- 不改日志中心窗口本身。
- 不新增第三枚快捷按钮。

## Impact

- `src/workspace.html`（FAB 面板 HTML/CSS）
- 相关冒烟若断言文案标签需同步放宽
