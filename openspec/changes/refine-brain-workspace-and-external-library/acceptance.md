# 制作人体验验收：Brain 工作区与外部知识库

日期：2026-08-27

## 核心路径

- [x] 1280×800 下默认折叠筛选与详情，中间图谱获得主要可用空间。
- [x] 星图与归类使用一致的浅色主题，不出现独立深色界面。
- [x] 空 Brain 仍具有按岗位初始化的八类知识骨架，骨架不计入“已理解”。
- [x] 默认 Brain 图只显示本地认知与岗位骨架；外挂 LLM Wiki 与 RAGFlow 不进入 Brain 图。
- [x] 一级页收敛为 `Brain｜知识库｜RAG`；本地目录与远程 RAG 分页管理。
- [x] “知识库”支持多个 LLM Wiki 目录，可浏览目录、设默认、刷新索引、打开原目录与移除入口。
- [x] “RAG”支持连接、目录同步、Collection 授权、编辑与断开。
- [x] 选择知识库不会隐式改变默认知识源。

## 验收证据

- `evidence/brain-compact-home.png`
- `evidence/brain-role-categories.png`
- `evidence/external-library-manager.png`
- `evidence/rag-library-manager.png`
- Playwright：1280×800 三条核心路径通过，浏览器 page error 为 0。
- 迁移审计：幂等、原来源未改动、`externalConceptLeak: false`。

## 结论

- [x] 本次范围通过
- [ ] 不通过

全量 `npm run check` 的本次代码相关测试、lint 与类型检查均通过；修正本 change 的旧 IA 断言后，仓库仍有 2 个非本 change 的 Renderer 失败，详见 `test-report.md`。
