# Tasks: boost-renderer-runtime-perf

- [x] 1. `ensureSurfaceCss` + WorkspaceApp 去掉非壳静态 CSS；各 surface 挂载时加载
- [x] 2. Composer 去 messages 整表订阅；AssistantPane useCallback；liveNow 默认 ≥500ms
- [x] 3. Assistant 延后 loadFileCatalog；@/filesOpen 触发
- [x] 4. applyStreamEvent rAF/32ms 合并 + flush
- [x] 5. 单测/回归 + npm test + lint + evidence/dev-self-test.md
- [x] 6. npm start 重启冒烟（流畅度）
