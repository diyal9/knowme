# Test Report

## 自动化

- `npm run check`：通过。
- Node 测试：1858 项，1807 通过、51 项既有跳过、0 失败。
- Renderer 测试：69 个测试文件、405 项测试全部通过（包含知识页、设置页、CSS 契约与无障碍回归）。
- Brain 专项：存储恢复、v3 幂等迁移、旧 Wiki 自动节点清理、显式引用保留、Provider 删除失效、提案确认/拒绝抑制、TTL cache、Agent 隔离、RAGFlow 元数据与查询均通过。
- Brain Query 专项：确认状态、时效、权威度、图距离、冲突标记、多跳解释与无授权不出站均通过。
- 联邦层专项：六类内置 Adapter 注册、文件夹/GitLab 授权根目录与路径穿越拒绝、RAGFlow/remote-rag 并行查询通过。
- Growth 专项：Brain、Partner Profile、Capability 三类确认提交、统一 Ledger、可逆效果和布局持久化通过。
- Evidence 不变量专项：持久 Claim 缺少 Evidence 或引用不存在的 Evidence 时拒绝写入；提案确认会先写 Evidence、再写 Claim。
- Agent 权限专项：个人伙伴、专业 Agent、隔离 Agent、Collection 交集、`kbQuery`/`kbGet` 越权拒绝通过。
- Brain Graph V3 专项：external concept 聚类隔离、本地认知主题聚类、外围 LLM Wiki Provider/Collection、标签预算、图谱密度控制与 SVG 节点可点击性通过。
- 归类视图专项：“星图 / 归类”切换、社区范围底图、8 组分类色、100 节点预算和社区内密排通过。

## 实际界面

- 使用 Vite + Chromium 注入受控 Brain 数据完成真实渲染。
- 验证 Brain 入口、三种视角、6 个本地认知主题簇、归类视图、本地 LLM Wiki 与 RAGFlow Collection 入口、边界提示、图谱/资料切换。
- 分别截图验证浅色星图和归类视图，确认搜索栏、筛选栏、画布、Inspector、状态栏与 KnowMe 共享主题一致。
- 浏览器 `pageerror` 为 0。
- 双节点关系链返回“我 → 参与项目 → KnowMe”并高亮路径；外挂 Collection Inspector 使用键盘可达。

## 迁移演练

- `npm run brain:migration:audit`：通过。
- 只读复制真实 `%APPDATA%\KnowMe` 中 6 个迁移相关元数据文件到临时目录；不输出个人正文。
- 连续迁移两次后节点、Claim、Evidence、Provider 数量完全一致，`idempotent=true`。
- 原目录指纹保持一致，`sourceUntouched=true`；外挂知识文档节点泄漏检查 `externalConceptLeak=false`。

## 回退

- Brain IPC 失败时 Store 自动切换资料视图。
- Provider 离线或查询失败时保留本地 Brain 命中与旧 RAG 降级路径。
