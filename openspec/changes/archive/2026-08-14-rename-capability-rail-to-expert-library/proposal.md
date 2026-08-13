## Why

左侧 rail 与能力 Hub 对外仍显示「能力 / 能力 Hub」，对 C 端过于抽象，且与「助理 / 工作台 / 知识网」等具体对象词不一致。用户真正管理的主对象是专家（技能与连接器为其配件），应统一对外命名为「专家库」。

目标用户：从左侧进入专家/技能/连接器目录、从工作台跳转安装专家的桌面用户。

体验价值：一级导航一眼可读；工作台 CTA「去专家库…」与入口同名，降低「能力界面 / 能力中心 / 能力 Hub」混用造成的认知摩擦。

## What Changes

- 左侧 rail `#btnRailCapabilities` 可见文案（`title` / `aria-label` / `.rail-label`）由「能力」改为「专家库」。
- Capability Hub 品牌标题、document title、宿主 drawer/iframe 标题由「能力 Hub」改为「专家库」。
- 工作台 / 设置 / toast 等指向该面的导航文案：`能力界面` / `能力中心` / `能力 Hub` →「专家库」。
- 更新 `workspace` / `capability-hub` / `slash-skill` 规格中对外命名要求；补充静态断言测试。

验收标准：

- 左侧 rail 显示「专家库」，点击仍打开统一 Capability Hub（专家 / 技能 / MCP 连接器 Tab）。
- Hub 顶栏与宿主标题显示「专家库」，不再出现「能力 Hub」用户可见字样。
- 工作台 CTA / 空态 / toast / 设置引导使用「专家库」。
- 代码标识符、IPC、目录名、模块名（`capability-*`、`btnRailCapabilities`）不变。
- 「添加能力」「能力包」「能力类型」等条目级/工程用语按 design 边界保留或仅改模块名引用。
- `npm test` / `npm run lint` 通过。

非目标（Non-goals）：

- 不改内部模块名、文件名、IPC channel、CSS class（`capability-hub` 等）。
- 不合并或删除 Hub 内「专家 / 技能 / MCP 连接器」Tab。
- 不改 Runtime「capability handshake / missing capabilities」等协议层英文/错误码。
- 不改「能力包」作为 package 产品概念（若出现在高级管理文案中）。
- 不重做 Hub 视觉与信息架构。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`：左侧 rail 与跳转文案对外命名为「专家库」。
- `capability-hub`：Hub 品牌标题与宿主顶栏对外命名为「专家库」。
- `slash-skill`：迁移引导文案对齐「专家库」。

## Impact

- `src/workspace.html`、`src/workspace.js`、`src/capability-hub.html`、`src/workbench.js`、`src/settings.html`、`src/main.js`、`src/workspace-agent.js`（用户可见字符串）。
- `tests/workspace-capability-rail.test.js` 等命名断言。
- 不新增依赖，不改 IPC。
