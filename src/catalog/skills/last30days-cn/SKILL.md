---
name: last30days-cn
description: >-
  中文八大平台近 N 天主题舆情与趋势调研：微博、小红书、B站、知乎、抖音、微信、百度、头条。
  触发词：舆情、last30days、近30天、中文平台讨论、热点追踪、主题日报。
version: 1.0.0
disable-model-invocation: false
---

# last30days-cn 中文舆情调研

本技能封装 [last30days-skill-cn](https://github.com/Jesseovo/last30days-skill-cn) 引擎，用于中文互联网近时段主题研究与舆情证据收集。

## 运行入口

优先通过 `run_skill_script`：

```text
run_skill_script
  skill_id: last30days-cn
  script: scripts/run_last30days.py
  args: { "topic": "<主题>", "mode": "quick", "emit": "compact" }
```

脚本会按顺序查找引擎：

1. 环境变量 `LAST30DAYS_ROOT`
2. `D:\Docs\openkb-wiki\vendor\last30days-skill-cn`（本机 OpenKB 侧已克隆时）
3. 同用户目录下已知 vendor 路径

也可直接：

```bash
python %LAST30DAYS_ROOT%\scripts\last30days.py "<主题>" --quick --emit compact
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `--quick` | 快速采样 |
| `--deep` | 加深覆盖 |
| `--emit compact` | 给 Agent 合成的紧凑证据（默认） |
| `--emit md` / `html-path` / `json` | 完整报告形态 |
| `--search weibo,bilibili,zhihu` | 限定平台 |
| `--as-of YYYY-MM-DD` | 历史回溯终点 |
| `--diagnose` | 环境与 Cookie 诊断 |

## 输出契约

- 保留引擎首行 badge（如 `🌐 last30days-cn v… · 数据截至 …`）；若含 `· 缓存`，须向用户说明。
- 只根据返回证据陈述；不得编造来源、互动量、日期或跨平台情绪。
- 覆盖稀疏时明确说明；平台失败如实报告。
- 最终答复默认中文。

## 配置

可选凭据：`%USERPROFILE%\.config\last30days-cn\.env`

首次向导：

```bash
python %LAST30DAYS_ROOT%\scripts\last30days.py setup
```

## 合成指引

1. 写明时间范围与实际命中来源。
2. 区分已证实发现与弱信号。
3. 重要结论附平台名与 URL。
4. 多平台同事件时比较差异。
5. 因源不可用影响置信度时写明。

## 合规

学习与个人研究用途；低频、遵守平台条款与 robots.txt；不做大规模商用采集或个人数据收集。
