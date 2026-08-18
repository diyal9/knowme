# 开发自测 — closeout-assistant-dialogue-parity

## 命令

```powershell
npm run test:renderer -- src/renderer/features/assistant/ src/renderer/features/files/files.spec.tsx src/renderer/features/content-view/content-view.spec.tsx
npm test
```

## 结果（2026-08-18）

| 命令 | 结果 |
|------|------|
| `test:renderer` assistant/content/files | 通过（见下方明细） |
| `npm test` | 通过（node --test 全量） |

### test:renderer 明细

- 34 tests passed（assistant 23 + files 6 + content-view 5）
- `npm test`：1586 pass / 0 fail

### test:renderer 覆盖点

## 行为核对

- [x] 助理气泡完成后显示「应用到文件」菜单（insert/append/replace）
- [x] insert/append：`sourcesReadFile` + 拼接 + `sourcesWriteFile` + toast
- [x] replace：`agentArtifactAdd(editor_patch)` → 产物卡确认
- [x] 产物列表来自 active session `run.artifacts`
- [x] Token 仍走 `assistantContextInfo`（模型菜单 Context Usage）
- [x] 用户气泡左对齐（`.agent-bubble.user { align-self:flex-start }`）
- [x] 流式 CSS：`.agent-bubble.streaming` + chunk 动画 + stream-cursor
- [x] 历史列表 `ModeAvatarMark`；知识菜单含 `knowledgeProviders`
- [x] FilesPane 预览时 `setAssistantApplyTarget`

## 未做 / 诚实标注

- 独立 token IPC：未新增（design Non-Goal）
- 真机截图：未附（建议制作人验收补）
