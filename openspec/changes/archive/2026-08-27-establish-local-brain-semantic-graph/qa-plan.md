# QA Plan

## Smoke Scope

- [x] 验证新用户空 Brain、旧数据迁移、重复迁移和损坏回退。
- [x] 验证推断/确认/拒绝/覆盖/忘记及证据解释。
- [x] 验证本地、外挂 LLM Wiki、remote-rag、RAGFlow 的路由、权限、超时和离线降级。
- [x] 验证图谱/资料切换、三种视角、节点详情、搜索、统一确认与伙伴设置跳转。
- [x] 验证 100 个可见节点的稳定布局、键盘操作和错误回退。
- [x] 验证 Obsidian 式主题簇、标签降噪、平移缩放、密度切换和主题钻取。
- [x] 验证 Wiki 资料不再全部直连“我”，旧自动 `knows` 关系可幂等迁移。
- [x] 验证“星图 / 归类”切换、100 节点社区布局、分类颜色和社区标题。
- [x] 验证搜索路径高亮、双节点关系链、节点拖动与布局持久化。
- [x] 验证统一 Growth Ledger 对 Brain、Partner Profile、Capability 的提交与撤销。
- [x] 验证 folder/GitLab Provider 按需读取、授权根目录和路径穿越拒绝。
- [x] 验证 Agent 无 Provider 授权时不出站，旧 `kbQuery`/`kbGet` 不能绕过 Collection 策略。
- [x] 在真实用户元数据的临时副本上运行两次迁移并验证源目录未变。
