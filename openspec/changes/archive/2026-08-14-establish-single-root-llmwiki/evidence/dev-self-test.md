# 开发自测报告

- 日期：2026-08-09
- Change：`establish-single-root-llmwiki`
- 开发状态：PASS，待制作人体验验收

## 自动化

- 根库服务与知识界面定向测试：PASS，33/33
- `npm test`：PASS，1543/1543
- `npm run lint`：PASS（lint ok；script-scope ok）
- `openspec validate establish-single-root-llmwiki --strict`：PASS
- `npm run llmwiki:ensure`：PASS，schema v1，issues 0

## Electron 冒烟

- `single-root-llmwiki-electron-smoke.js`：PASS，6/6
- 首页单根知识心智、三个一级 Tab：PASS
- 左侧“知识网”入口、首页真实“资料/已整理知识 → 子目录 → 条目”目录树：PASS
- 根目录翻译、真实子目录、后代计数、前两层展开与条目打开：PASS
- 默认页面内部术语隔离：PASS
- raw 编辑 dirty 状态与安全保存：PASS
- 保存后搜索命中：PASS
- Renderer console error / pageerror：0 / 0

## 检索接口

- `llmwiki-service` 已统一提供 query / ingest / lint，并接入界面、Agent 与本地 Provider。
- qmd CLI 参数与 collection 隔离契约测试：PASS。
- 当前开发机未安装全局 `qmd` 命令；实测按设计降级为本地词面检索，返回状态不会伪报 qmd 成功。

## 证据

- `evidence/single-root-llmwiki-electron-smoke.json`
- `evidence/screenshots/single-root-knowledge-home.png`
- `evidence/screenshots/raw-visual-editor.png`

## 手动观察

- KnowMe 主进程正常启动。
- 实际默认根库 `%APPDATA%\KnowMe\knowledge-os\wiki` Harness 检查通过。
- 用户现可直接打开应用体验；本报告不替代制作人验收与正式 QA。

## 追加：知识网首屏重设计（2026-08-10）

范围：把知识网首屏从「运维台」收敛为「结构优先的第二大脑」心智（对应 tasks 第 7、8 节）。

变更要点：
- 空库首触：默认首页 `stats.total === 0` 分支改为居中欢迎引导（身份「你的知识网」+ 价值/主权一句 + 放进来/AI 整理/随时查 三步 + 内联投喂 + 唯一主 CTA「添加第一份资料」+ 弱次入口「连接来源」）；首份保存成功后就地「要我把它整理成知识吗 / 以后再说」闭环。
- 有资料常态：默认首页从 Query/Ingest/Lint 运维台改为真实索引树 `knowledgeRootIndexHtml` + 醒目搜索；待确认做横幅，最近/整理/体检降为紧凑辅助；检索状态文案去术语（`已查询根 LLM Wiki` → `已查询你的结构化知识`）。
- 「网」可感知：侧栏新增弱次级入口「知识关联」，按需打开既有 Fabric 关系视图（概念/锚点/关系边，非默认一级页面）。
- 抽出可复用 `saveKnowledgeMaterial`，欢迎引导与添加弹窗共用。

自动化（2026-08-10 复跑）：
- `npm test`：PASS，1567/1567（含新增契约测试：空库首触、树优先常态、知识关联入口）。
- `npm run lint`：PASS（lint ok；script-scope ok）。
- `openspec validate establish-single-root-llmwiki --strict`：PASS（Change is valid）。
- Harness gate（`harness.js gate`）：ok=true，blocking=false；`npm-test` / `npm-lint` 硬项均 pass，本 change 无 finding。

规格调和：
- 将 `knowledge-os` 的空库场景由「保留两空目录树」改为「居中欢迎引导 + 首份闭环」，并新增「空库首触引导与首份闭环」需求；常态「用户任务驱动的知识首页」需求本已要求真实结构树为主体，本次将实现带回合规。

待补：
- 首屏三态截图证据（`screenshots/`）与制作人体验验收，仍需在验收阶段补齐；本报告不替代制作人验收与正式 QA。
