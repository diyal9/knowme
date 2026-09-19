# RQA109 — 通用成果物预览与验收操作条

日期：2026-09-08

## 变更

将成果物 UI 拆成两个平台级职责：

- `ArtifactPreview` 只负责媒体/文件预览和打开行为；图片不会把“待验收”或接受/拒绝按钮嵌进图片区域。
- 新增 `ArtifactActionBar`，统一承载成果物状态及接受、拒绝、修改、重试等操作。
- 通用助手产物列表不再维护图片专用的 `agent-image-review` 分支；图片、文档、代码等产物通过同一操作条契约渲染。

这样 Agent 只需要声明成果物的 `kind`、`state` 和 `actions`，不需要让 KnowMe 为某个专家或某种文件类型增加专用 UI。

## 验证

- `artifact-preview.spec.tsx`：4/4
- `assistant.spec.tsx`：38/38
- `expert-task-room.spec.tsx`：68/68
- `artifact-thumbnail-layout.spec.tsx`：9/9
- 以上定向渲染测试合计：119/119
- 完整 `npm run check`：exit 0；Renderer 86 个测试文件、620 个测试通过；lint/typecheck 通过
- `git diff --check`：通过；仅报告共享工作区既有 CRLF 规范化提示，无空白错误

## 仍未证明的事项

该改动证明了预览/验收 UI 的通用组件契约和本地回归，不等于远程生图、飞书或公开网络路线已经取得真实执行回执；`executionReady` / `productionReady` 仍需保持未就绪，直到条件路线完成真实或等价隔离执行验收。
