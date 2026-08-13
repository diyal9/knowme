# 开发自测 — show-workflow-card-updated-at

日期：2026-08-12

## 命令

| 命令 | 结果 |
|------|------|
| `npm test` | 1716/1716 pass |
| `npm run lint` | ok（含 script-scope） |

## 行为核对

- `shelfUpdatedHtml`：`updatedAt` → `createdAt`，相对时间「更新于 …」，`<time title>` 绝对时间
- 页脚：左 `.wb-shelf-updated`，右 `.wb-shelf-actions`
- 无有效时间戳：不渲染时间节点
- 结构断言：`tests/workbench-templates.test.js` 「shows last updated time on the shelf card footer left」

## 结论

开发自测门禁通过，可交制作人体验验收。
