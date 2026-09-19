---
name: crawl4ai
description: >-
  用 Crawl4AI 抓取 JS 重度页面、并发多 URL，或按 CSS/JSON Schema 抽取结构化内容。
  触发词：crawl4ai、网页抓取、SPA、无头浏览器、markdown 抓页、批量爬取。
  静态文档页优先用平台 fetch_web_page；本技能专注浏览器渲染与可复用抽取。
version: 1.0.0
disable-model-invocation: false
---

# Crawl4AI 网页抓取

本技能完全基于 [Crawl4AI](https://github.com/unclecode/crawl4ai)（开源 LLM 友好爬虫）。用它把网页变成干净 Markdown 或结构化 JSON，供后续分析。

## 前置条件

本机需可用：

```bash
pip install crawl4ai
crawl4ai-setup
crawl4ai-doctor
```

KnowMe 侧优先通过 `run_skill_script` 执行本包 `scripts/`；也可在已安装环境直接调用 `crwl` CLI。

## 默认路径（单 URL → Markdown）

对用户给出的单个 URL、且未声明抽取/批量/登录需求时：

```text
run_skill_script
  skill_id: crawl4ai
  script: scripts/crawl_markdown.py
  args: { "url": "<目标 URL>" }
```

等价 CLI：

```bash
crwl <url> -c "wait_until=networkidle,page_timeout=60000" -o markdown
```

`wait_until=networkidle` 适合未指定具体选择器的 JS 渲染页。用户点名某个元素时改用 `wait_for=css:<selector>`。

## 何时使用

- JS 渲染、SPA、需等待网络空闲的页面
- 多 URL 并发抓取
- 可复用 CSS/JSON Schema 结构化抽取
- 需要截图或浏览器级内容清洗

## 何时不要使用

- 静态文档/博客：优先 `fetch_web_page`
- 本地 PDF/Office 转换：不走本技能
- 多步表单交互、复杂登录态流程：先说明能力边界，不假装已完成交互爬取

## 执行纪律

1. 先确认目标 URL、是否需要 Schema、是否批量。
2. 真实调用脚本或 `crwl`，以回执为准；禁止编造页面正文。
3. 失败时报告具体错误（浏览器未就绪、超时、反爬、依赖缺失），给出可执行修复建议。
4. 交付时保留来源 URL、抓取时间、内容形态（markdown / json）与关键截断说明。
5. 遵守站点条款与 robots.txt，低频、只取任务必要内容。

## 常用变体

```bash
# Markdown
crwl https://example.com -o markdown

# JSON + 跳过缓存
crwl https://example.com -o json -v --bypass-cache

# 诊断
crawl4ai-doctor
```

包内脚本：

| 脚本 | 用途 |
|------|------|
| `scripts/crawl_markdown.py` | 单 URL → Markdown（默认） |
| `scripts/doctor.py` | 检查 crawl4ai / 浏览器是否就绪 |
