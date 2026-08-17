# Code review — architecture sweep

## Scope

replace-main-vm-with-modules, thin-ai-generate-retire-legacy, split-workbench-features-and-stores, componentize-css-and-ux-sweep, lib-typed-modules-no-god-files, ipc-hygiene-docs-and-review.

## Findings

| 级别 | 项 | 处理 |
|---|---|---|
| BLOCKING | VM concat | 已改为 part-* + ipc-bind 显式 require |
| BLOCKING | legacy ai-generate 循环 | 已删除 |
| BLOCKING | @ts-nocheck in lib/main/ipc | 已清零并纳入 lint |
| ADVISORY | lib 超限文件仍多 | 白名单只许缩小；本轮未新增超限项，且已将 `ai-generate` 从白名单移除 |
| ADVISORY | Zustand 仍单店 | 切片已下沉 feature，compose 仍在 app/store.ts |

## 结论

BLOCKING 已自修。非目标（便签窗、cron、文件分屏、飞书 iframe）不纳入。
