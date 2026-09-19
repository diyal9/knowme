# Design

## Role taxonomy

`brain-taxonomy` 生成带版本和岗位签名的 root/category 节点及 Evidence-backed `contains` 关系。节点使用 `brain-taxonomy` 标签，使查询、统计与遗忘逻辑能够把组织结构和真实认知分开。`ensureReady` 比较 `taxonomyVersion + taxonomyProfileId`，只在版本或岗位变化时重建投影。

## Classification

Renderer 优先读取固定分类节点。真实 concept 先按显式 `taxonomy:*` 标签归类，再按分类关键词匹配，最后进入岗位模板的兜底分类。空分类仍显示，使空 Brain 也有稳定地图。

## Compact graph

图谱布局使用固定 52px 图标工具栏和按需 Inspector。岗位分类模式使用中心 Brain、外围主题卡、外围有向循环与回到 Brain 的虚线关系，主题内部节点只在钻取后显示。所有色彩继续复用 KnowMe 浅色 token。

## External library manager

一级页面拆为“知识库”和“RAG”。知识库页只管理 qmd-local、folder、GitLab 等本地挂载 Provider，并通过内容源授权根目录提供目录树；RAG 页只管理 ragflow 和 remote-rag。选择 Provider 不改变默认源；“设为默认”是单独操作。Collection 勾选只修改 Agent 授权列表。删除 Provider 后 Brain 保留历史引用并将来源标记不可用。

## Multiple LLM Wiki mounts

选择本地目录时先创建受控 Content Source，再创建引用该 sourceId 的 qmd-local Provider。每个 Provider 有稳定 ID、独立 collectionId 与子目录；查询时才读取正文。目录树使用既有 `sources-tree` / `sources-tree-children` 安全边界，不接收任意绝对路径。

## RAGFlow protocol and secrets

目录同步调用 `GET /api/v1/datasets`，检索调用 `POST /api/v1/retrieval`。API Key 只通过 Provider IPC 进入主进程，使用 Electron safeStorage 加密为 `apiKeyEnc`；Renderer 列表只得到 `hasApiKey`。
