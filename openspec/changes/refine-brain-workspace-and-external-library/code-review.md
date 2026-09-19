# Code Review：Brain 工作区与外部知识库

日期：2026-08-27

## 审查结论

- 岗位 taxonomy 使用稳定 ID、版本签名与 Evidence-backed Claim；岗位切换只替换骨架，不删除真实认知。
- taxonomy 从 Brain Query 和理解统计中排除，避免把产品预置结构伪装成“懂你”。
- 外部 LLM Wiki、RAGFlow 仍是 Provider/Collection 入口；默认 Brain 图不投影外部文档，也不复制正文。
- 每个本地 LLM Wiki 使用独立 Provider 与稳定 source binding，连续添加不会发生 ID 碰撞。
- RAGFlow 使用官方 Dataset 列表与 Retrieval API；密钥不进入 Renderer、日志或明文配置，Windows 下可用 DPAPI 安全回退。
- 外部知识库的“选择”和“设为默认”分离，避免浏览动作产生隐式配置写入。
- 默认折叠面板扩大画布；选中节点才展开详情，并保留资料视图降级路径。
- 未新增原生数据库依赖；现有原子 JSON、Provider 权限与迁移回退边界保持不变。

## 风险与后续

- 首期关键词归类是确定性启发式，后续可增加“建议移动分类”提案，但不得自动改写确认认知。
- 大于 100 个可见节点仍应由密度和两跳限制控制，不扩展为无限图。
- 仓库级全量门禁存在 2 个与本次范围无关的专家工作台/能力中心 Renderer 失败，未在本 change 中越界修复。
