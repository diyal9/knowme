# 授权引导 — bootstrap_auth（Git Bash）

Agent **必须**在 Git Bash 中调用 Python 脚本完成飞书授权与 TE 登录，勿只贴命令让用户手敲。

## 两套登录，别混淆

| 目标 | 机制 | 浏览器 |
|------|------|--------|
| **飞书文档** | `lark-cli auth login`（OAuth device code） | **系统默认浏览器**（Chrome/Edge），非 Playwright |
| **TE BI** | Playwright 保存 `storage_state.json` | Playwright 弹出窗口，或连接本机已开浏览器 |

飞书授权**不会**也**不需要**从 Playwright 读 cookie；token 存在 lark-cli 凭据里。

## 一键引导（推荐）

```bash
bash .cursor/skills/te-report-playwright-export/scripts/bootstrap_auth.sh --initiate
```

顺序：

1. **飞书** — `lark-cli auth login --scope docx:document:readonly --no-wait`，打开授权页；用户完成后 `--complete-feishu`
2. **TE** — **默认弹出本机 Chrome** 登录 `bi.forevernine.net`，保存 `storage_state.json`（非 Playwright 自带 Chromium）

飞书授权在浏览器完成后：

```bash
bash .cursor/skills/te-report-playwright-export/scripts/bootstrap_auth.sh --complete-feishu
```

## 页面一直闪？

旧版 TE 登录脚本每 3 秒 `page.goto` 探测登录态，会导致窗口闪烁；已改为**在当前标签页静默轮询**，登录完成后再跳转验证。

若 `--initiate` 同时拉起飞书 + TE 两个窗口，属正常；可拆开执行：

```bash
# 仅飞书（不弹 TE 窗口）
bash scripts/bootstrap_auth.sh --initiate --skip-te
bash scripts/bootstrap_auth.sh --complete-feishu

# 仅 TE（飞书已授权时）
bash scripts/bootstrap_auth.sh --te-login --skip-feishu
```

## 使用本机浏览器（TE，默认方式 A）

TE 登录**默认**使用本机 **Chrome**（`--browser-channel chrome`），无需额外参数：

```bash
bash scripts/bootstrap_auth.sh --te-login --skip-feishu
```

无 Chrome 时可改用 Edge：

```bash
bash scripts/bootstrap_auth.sh --te-login --skip-feishu --browser-channel msedge
```

回退 Playwright 自带 Chromium：

```bash
bash scripts/bootstrap_auth.sh --te-login --skip-feishu --browser-channel chromium
```

### 方式 B — 连接已打开的浏览器（复用已有登录）

1. 先在本机 Chrome 用调试端口启动（Windows 示例）：

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

2. 在**该窗口**打开并登录 `https://bi.forevernine.net/`
3. 运行：

```bash
bash scripts/bootstrap_auth.sh --te-login --skip-feishu --connect-cdp http://127.0.0.1:9222
```

脚本只**读取** cookie 写入 `storage_state.json`，**不会关闭**你的浏览器。

### 飞书 — 手动打开授权页（避免自动弹窗）

```bash
bash scripts/bootstrap_auth.sh --initiate --no-open-browser --skip-te
```

终端会输出 `verification_url`；在你习惯的浏览器里手动打开该链接，完成后：

```bash
bash scripts/bootstrap_auth.sh --complete-feishu
```

若 `lark-cli auth check --scope docx:document:readonly` 已通过，**无需再授权飞书**。

## 分步

| 命令 | 用途 |
|------|------|
| `bootstrap_auth.sh --check-only` | 仅检测飞书 scope + TE cookie |
| `bootstrap_auth.sh --initiate` | 发起飞书授权 + TE 浏览器登录 |
| `bootstrap_auth.sh --complete-feishu` | 飞书 device_code 轮询完成 |
| `bootstrap_auth.sh --te-login --skip-feishu` | 仅 TE 登录（**默认本机 Chrome**） |
| `--browser-channel msedge\|chromium` | 覆盖默认浏览器 |
| `--connect-cdp http://127.0.0.1:9222` | TE 复用已开浏览器 |
| `--no-open-browser` | 飞书不自动弹窗，手动打开 URL |

## 记忆路径

`<memory_root>/te-report-playwright-export/`

- `storage_state.json` — TE cookie  
- `feishu_auth_pending.json` — 待完成飞书授权  
- `feishu_auth_qr.png` — 授权二维码  

`memory_root` 默认：`%LOCALAPPDATA%/th-bi/memory/<workspace_id>/`（与 `memory_paths.py` 一致）

## lark-cli

脚本自动解析 `%APPDATA%/npm/lark-cli`；未安装时 exit **22**。

Read **lark-shared** 了解 split-flow 与 scope 规则。
