## Specification and Core

- [x] 实现 BrainStore、数据模型、原子持久化与状态统计
- [x] 实现旧 Fabric、Memory 和 Provider 的幂等迁移；Wiki/OKF 只迁移目录引用，不迁移文档节点
- [x] 实现 snapshot、neighborhood、query、explain、proposal、forget、rebuild

## Federation and Runtime

- [x] 实现 Provider Adapter 与 Collection Catalog
- [x] 扩展本地、remote-rag 并新增 RAGFlow 元数据/查询适配
- [x] 实现 Agent Knowledge Policy、最小权限路由和临时 Evidence
- [x] 接入 Agent 检索与 Context Engine，保留失败降级

## Product Surface

- [x] 新增 Brain 图谱首页与图谱/资料切换
- [x] 新增三种视角、筛选、搜索、邻域展开和 Inspector
- [x] 统一知识、记忆、Fabric 与成长确认入口
- [x] 收敛伙伴设置中的记忆与成长表面

## Obsidian Graph Refinement

- [x] 使用 v3 迁移彻底移除自动生成的 Wiki/OKF 文档节点，只保留 Provider/Collection 入口和用户主动收藏引用
- [x] 实现懂我、当前工作和知识版图的独立投影规则
- [x] 将高密度资料折叠为稳定主题簇，支持双击钻取与返回
- [x] 重做与 KnowMe 主题一致的浅色沉浸画布、标签降噪、曲线路径、平移缩放和密度切换
- [x] 聚合 Inspector 中重复关系，并增加知识版图与主题概览
- [x] 新增“星图 / 归类”双表达，归类模式按领域社区呈现最多 100 个节点
- [x] 实现社区范围底图、分类色、领域标题和社区内密集节点布局
- [x] 统一 Brain 搜索、筛选、画布、Inspector 与状态栏的主题 token，保留 Obsidian 点线交互但不引入独立暗色皮肤
- [x] Renderer 防御性排除 external concept 聚类，外挂 LLM Wiki 仅以外围来源和知识库节点表达

## Verification

- [x] 核心数据、迁移、查询、权限、外部 Provider 单元测试
- [x] Brain Renderer 交互和无障碍回归
- [x] `npm run check` 与 Harness gate
- [x] 制作人验收、测试 QA 和代码审查

## Strict Closeout

- [x] Brain Query 将确认状态、时效、权威度、图距离和冲突纳入重排，并返回可解释的多跳关系路径
- [x] Provider Adapter Registry 覆盖 local、qmd-local、folder、gitlab、remote-rag 和 RAGFlow；文件夹与 GitLab 正文只在授权目录内按需读取
- [x] 建立统一 Growth Ledger，确认后的认知、伙伴协作方式和能力变更分别提交 Brain、Partner Profile 与 Capability Hub，并支持撤销
- [x] 图谱支持节点拖动与布局持久化、搜索路径高亮、双节点最短关系链和失败回退资料视图
- [x] Agent Knowledge Policy 同时约束 Brain scope、个人 Memory、Provider、Collection、直接 `kbQuery` 与 `kbGet`，空授权严格不发远程请求
- [x] 在真实 `%APPDATA%\KnowMe` 元数据副本上完成两次幂等迁移演练，确认源数据指纹不变且外挂正文未进入 Brain
- [x] 使用 Playwright 验证浅色星图、领域归类、Collection 边界、关系链、资料回退和零浏览器错误
