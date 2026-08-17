---
name: team-learned-dev-electron-runloop
description: >-
  Use when the user asks to 打包/执行/重启 KnowMe, or after UI/src changes need
  a local Electron restart, npm start, or electron-builder package.
---

# Electron 跑通闭环（打包 / 执行 / 重启）

KnowMe 桌面端常用口令「打包 / 执行 / 重启」对应同一套本地跑通流程。本 Skill 固化命令与顺序，避免每次临场拼装。

## When to Use

- 用户说：打包、执行、重启、重启体验、`npm start`、看一眼效果、重新打开应用
- 改完 `src/**`（尤其 HTML/CSS/主进程）需要真机冒烟
- 需要打 Windows/mac 安装包或目录包

## When NOT to Use

- 仅跑单元测试 / lint（用 `npm test` / `npm run lint` 即可，不必启动 GUI）
- Story 门禁硬项（用 `npm run harness:gate` / `/gate-check`）
- 用户只要代码 diff、不要启动

## Workflow

### 1. 执行（开发自测默认）

```bash
npm start
```

- **日常开发**：`npm start` = 清残留 + Vite HMR + `electron . --dev`（`scripts/dev-app.js`）
- **MUST NOT** 为了看 UI 而先 `renderer:build`
- 改 `src/renderer/**` / CSS：保存后热更新或窗口刷新即可
- 改主进程 / preload：再跑一次 `npm start`（脚本会先杀旧进程）
- 仓库路径可能经 junction/symlink；脚本会 `chdir` 真实路径，否则 Vite 预构建会崩
- Git Bash 下 **不要**手搓 `taskkill /F`（`/F` 会被当成路径）。清场用 `npm run kill` 或直接再 `npm start`

### 2. 重启 / 重启体验

口令「重启」= **再跑一次 `npm start`**（内部已 `kill-knowme`）。不要再拼 `taskkill`。

| 场景 | 做什么 |
|------|--------|
| 日常改界面 / 重启体验 | `npm start`。**MUST NOT** `renderer:build` |
| 用户明确要打安装包 / 核对 dist | `npm run renderer:build` 后 `npm run start:dist` |
| 仅主进程 / `src/lib` / `src/ipc` / preload | `npm start` |

`npm run start:dist` **不带 `--dev`**，加载 `dist/renderer/`。

- 进程名优先：`KnowMe.exe`；开发态兜底：`electron.exe`；另杀占用 **5173** 的进程
- 重启后 MUST 核对主进程 PID 已变；PID 不变说明旧窗口还在，用户会感觉「没有变化」

### 3. 打包

| 目标 | 命令 |
|------|------|
| 本机目录包（快） | `npm run build:dir` |
| Windows 安装包 | `npm run build:win` |
| mac 包 | `npm run build:mac` |
| 完整 build | `npm run build` |

打包前建议：`npm test && npm run lint`。  
产物与 `electron-builder` 配置见 `package.json`。

### 4. 与门禁的关系

```
改代码 → npm start 冒烟（本 Skill）
       → npm test + lint（硬门禁）
       → 制作人验收 / QA（角色 Skill）
```

不要用「打包」代替「测试通过」。

## 产出话术（对用户）

- 执行：`已 npm start（热更），请看工作台…`
- 重启：`已清残留并重启热更会话，请验证 …`
- 重启体验：默认不编渲染包；仅核对发行包时才说「已 renderer:build + start:dist」
- 打包：`已跑 build:*，产物路径 …`
