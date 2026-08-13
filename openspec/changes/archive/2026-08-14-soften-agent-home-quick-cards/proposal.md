## Why

Agent 首页「开始使用」区当前把输入框与四张实心快捷卡、底部绿色「启动工作流」叠在一起，快捷入口抢视线，工作流条也不是首屏主路径。需要让对话输入重新成为第一焦点，快捷任务退为轻量提示。

## What Changes

- 从 `game-studio` 空状态中隐藏 `workflow-intake`（`showInEmptyState: false`），不再渲染底部「启动工作流 / 需求梳理」条
- 对首页四张推荐卡做「轻档」弱化：去阴影/弱边框/透明底、缩小图标块、标题与描述降对比，保留可点击与 2×2 布局
- 更新相关测试与自测证据

## 目标用户

日常打开 KnowMe 助手、以自由输入为主、偶尔点快捷场景的办公用户。

## 验收标准

- 空状态不再出现「启动工作流」入口
- 仍展示最多四张推荐任务卡，点击仍走原有 preflight/执行链路
- 四卡视觉明显弱于 Composer，但 hover/焦点仍可识别为按钮
- `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不删除 `workflow-intake` 场景、技能或工作台启动能力
- 不改 Composer 文案与布局
- 不统一专家空态卡片样式
- 不做「中/重」档弱化（无图标 / 纯文字 chip）

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace`: 游戏工作室空状态不再展示独立工作流条；推荐卡仍为最多四张
- `agent-chat-ux`: 首页推荐卡采用弱化视觉，不与 Composer 抢焦点

## Impact

- `src/packs/game-studio/scenes.json`
- `src/workspace.html`（`.agent-empty-home` 下卡片样式）
- `tests/game-studio-scenes.test.js`（空状态 scene 列表断言）
