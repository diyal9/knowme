# Retro: agent-web-fetch-tool

日期：2026-08-03

## 做了什么

- 新增 `fetch_web_page` Agent 工具：公开 http/https 网页可读正文
- 抽出 `src/lib/web-fetch.js`（SSRF、超时、限量、正文提取），与「内容源 → 添加网页」共用
- 提示词 + 工具描述双写：外链 vs 飞书分流；禁止未调工具就否认联网能力
- 29 条 `web-fetch` 单测 + 工具面/提示词断言；gate `ok=true`

## 学到什么

1. **高频且有安全边界的能力必须固化为一等工具**，不能指望模型每次用 `run_python` 现写抓取——否则无 SSRF、无稳定错误码、无时间线可读标题。
2. **「默认无网络」若只拦 shell 命令名，等于假安全**：`run_python` 里 `urllib`/`requests`/`socket` 仍可外联（本 Story 未修，记待办）。
3. **十六进制 HTML 实体**（`&#x27;`）与十进制要同等处理；真实公网页是最好的回归样本。
4. **真机 LLM 选工具**无法在无 API Key 环境硬证：工具存在 + 描述边界 + 提示词分流可作为 ADVISORY 放行，与历史惯例一致。

## 复发 / 待办

- [ ] 沙箱网络绕过：补 Python/Node 层危险 API 识别；`agentScriptsEnabled` / `allowNetwork` 补设置 UI
- [ ] 用户本地粘贴 Anthropic + 飞书链接各确认一次模型分流（S1/S2）

## 是否升格

暂不升 OKF。若「外链误走飞书搜索」或「沙箱假无网」再复发 ≥3，走 `/evolve`。
