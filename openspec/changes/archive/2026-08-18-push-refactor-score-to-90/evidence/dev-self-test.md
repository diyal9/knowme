# 开发自测 — push-refactor-score-to-90

- 日期：2026-08-18
- lint：PASS
- npm test：1586 pass / 0 fail
- test:renderer assistant + shell-rail + context-usage：31 pass

## 落地

- chrome 191KB → shell 24KB + agent 105KB + knowledge 66KB（知识懒加载）
- workbench-layout 178KB → core 146KB + studio 31KB + daemon 6KB
- MESSAGE_PAGE=24；非流式 ContentView lazy；Context Usage「估算/会话用量」
