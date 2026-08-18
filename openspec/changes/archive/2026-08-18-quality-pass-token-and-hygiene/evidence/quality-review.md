# 品质向上 Review 汇总

日期：2026-08-12  
范围：体验对齐 / 不闭环 / 临时残留 / 代码结构·硬编码·性能·安全·扩展性  
原则：小修即改、大改先汇总、不改坏、不大动交互

---

## 已即刻修复（change: `quality-pass-token-and-hygiene`）

| 项 | 改动 |
|----|------|
| 主按钮黑绿混用 | `.wb-run-btn.primary` / `.wb-modal-btn.primary` → `--wb-accent` |
| Review 状态色 | 进度条/步骤标记 → `--wb-success/warning/danger` |
| border token | 补 `--wb-border: var(--wb-line)` |
| Studio 主钮 | `#2f7461` → `--wb-accent` |
| 死代码 | 删除 `INTENT_TEMPLATES`；删除 `MOCK_CATALOG` |

自测：`npm test` 1728/1728；`npm run lint` 见本轮执行结果。

---

## 大改待你拍板（未动手）

### A. 体验 / 设计 token 宪章（P2）

1. **双 accent 语义**：壳层/Hub 炭黑 `--accent` vs 工作台绿 `--wb-accent` — 保留双语义还是统一？
2. **`workbench-layout.css` 千级 hex 清扫** + Hub 映射 `--wb-*`
3. **圆角/字号阶梯**文档化（控件 6|8、卡片 12…）；Studio 仍 9–10px 密排

### B. 不闭环功能（诚实降级，非假数据）

| 入口 | 现状 | 建议 |
|------|------|------|
| 产物审阅 | toast「暂不支持」 | 隐藏入口或做最小闭环 |
| 建议动作部分类型 | toast | 白名单可见动作 |
| 会话级知识库选择 | toast | 产品排期或灰显 |
| 文件选择器 | toast | 接系统 dialog 或隐藏 |

### C. 临时 / 演示残留（ADVISORY）

- `VERTICAL_PIPELINE_SEEDS` 常量仍在，货架已 `verticals: []`（兼容历史 id）
- `example-minimal` pack 默认不装
- 「团队」徽章 = 非个人来源标签，易与旧演示卡混淆（命名可改「官方/仓库」）

### D. 安全（建议独立 harden change）

| 级别 | 项 | 说明 |
|------|-----|------|
| BLOCKING | `open-external` 允许 `file:` | 渲染层可打开本地 file URL；去掉可能影响链接预览开本地文件，需兼容方案 |
| BLOCKING | `<webview>` 无 guest 防护 | 需 `will-attach-webview` + 导航白名单 |
| BLOCKING | `get-settings` 明文下发 apiKey | 非设置窗应 redact |
| BLOCKING | `sources-read-file` 无 size cap | 主进程可被大文件卡死 |

### E. 结构 / 性能 / 扩展（Epic）

- `workbench.js` ~1万行、`main.js` ~8千行 + ~235 IPC — 按域拆分
- 聊天 `renderChat` 全量 innerHTML — 增量/虚拟列表
- `ui-kit` / `markdown-lite` 未进工作台主路径 — 先统一 escape

---

## 建议下一步优先级

1. **你确认视觉小修**（本 change）→ 制作人验收 → `/story-done`
2. **安全 harden**（D）单独 OpenSpec，逐项确认兼容面
3. **不闭环入口**（B）选做隐藏 vs 实现
4. Token 宪章 + 结构拆分排期

请回复要推进哪些大项（可多选编号）。
