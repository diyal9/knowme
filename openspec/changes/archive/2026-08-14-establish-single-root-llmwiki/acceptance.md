# 制作人验收

- Change：`establish-single-root-llmwiki`
- 当前阶段：开发自测已完成，等待制作人体验验收

## 验收目标

- [ ] 用户首次进入时只看到“我的知识”“待我确认”“来源”，无需理解 LLM Wiki、OKF、Fabric 或治理术语。
- [ ] “我的知识”首屏优先展示真实目录、子目录与条目，并可直接搜索、添加资料、打开条目和发起整理。
- [ ] 新建资料进入 `raw/`，可以在应用内编辑、预览、保存；切换页面时不会静默丢失未保存内容。
- [ ] AI 整理建议先进入“待我确认”，接受前可以编辑，拒绝或稍后处理不会写入稳定知识。
- [ ] 默认根库为空结构，不包含 KnowMe 帮助文档或示例事实。
- [ ] 外部来源仍可配置，但不改变“我的知识”作为默认根空间的产品心智。

## 验收目标（2026-08-10 追加：知识网首屏重设计）

- [ ] 空库打开知识网时，10 秒内能理解「这是放我资料、AI 帮我整理、我说了算」的第二大脑心智，且只有一个明显动作「添加第一份资料」。
- [ ] 放入第一份资料后立即被引导「要我整理吗」，可在一次会话内走完 放→整理→待我确认 闭环。
- [ ] 有资料后首屏以真实结构树为主体、搜索醒目可用；待确认以横幅直达，不被埋进小卡片。
- [ ] 首屏及常态不出现 LLM Wiki/Query/Ingest/Lint/qmd/raw 等实现术语作为标题或操作名。
- [ ] 好奇用户可通过侧栏「知识关联」看到知识如何连成网，但它不打扰默认主流程。

## 体验证据

- 首页：`evidence/screenshots/single-root-knowledge-home.png`
- raw 编辑器：`evidence/screenshots/raw-visual-editor.png`
- Electron 报告：`evidence/single-root-llmwiki-electron-smoke.json`
- 首屏三态（待补）：`evidence/screenshots/knowledge-empty-first-touch.png`、`knowledge-home-indexed.png`、`knowledge-relations.png`
