# Design: knowledge-settings-refactor

## UI

- 一行摘要：`N 概念 · 校验状态 · 记忆 M`
- 主题列表：checkbox + 折叠条目；条目点击 → 预览抽屉
- 工具栏：全选 / 导出所选 / 导入；次要：打开目录、记忆面板

## 导出

`exportBundle(dir, dest, { categories?: string[] })`
- 未传 / 空 / 全部分类 id → 整包拷贝（兼容旧行为）
- 子集：复制 `index.md`（按所选重写目录）、`log.md`、所选分类下概念文件 → lint → MANIFEST

## IPC

- `knowledge-read-concept` → `{ ok, title, body, rel }`
- `knowledge-export` 接收可选 `{ categories }`
