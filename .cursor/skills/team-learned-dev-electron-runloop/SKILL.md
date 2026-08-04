---
name: team-learned-dev-electron-runloop
description: >-
  Use when the user asks to 打包/执行/重启 KnowMe, or after UI/src changes need
  a local Electron restart, npm start, or electron-builder package.
---

# Electron 跑通闭环（打包 / 执行 / 重启）

KnowMe 桌面端常用口令「打包 / 执行 / 重启」对应同一套本地跑通流程。本 Skill 固化命令与顺序，避免每次临场拼装。

## When to Use

- 用户说：打包、执行、重启、`npm start`、看一眼效果、重新打开应用
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

- 端口/旧进程占用：同会话可直接覆盖；先关掉残留 Electron 再启更干净
- 改完渲染层/主进程后：**必须重启** 才能看到效果（热更新不可靠）

### 2. 重启

1. 结束当前 Electron 窗口/进程  
2. 再跑 `npm start`  
3. 核对：控制台无 uncaught error；本次改动的画面/热键路径

口令「重启」= **杀进程 + `npm start`**，不是只刷新某个 HTML。

Windows 清理残留进程时，MUST 以 **KnowMe** 为进程标识，不再使用 `sticky-notes` 关键字：

```bash
powershell -NoProfile -Command "$targets = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?|node(\\.exe)?|npm(\\.cmd)?') -and ($_.CommandLine -match 'knowme|electron \\.') }; $ids = $targets | Select-Object -ExpandProperty ProcessId -Unique; if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"
npm start
```

- 进程名优先：`KnowMe.exe`
- 开发态兜底：`electron.exe` + `CommandLine` 含 `knowme`

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

- 执行：`已 npm start，请看工作台…`  
- 重启：`已重启应用，请验证 …`  
- 打包：`已跑 build:*，产物路径 …`
