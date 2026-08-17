# Design: perf-hygiene-refactor-closeout

## P0-1 图标作用域 mount

```typescript
useKnowMeIcons(dep?, rootRef?: RefObject<HTMLElement | null>)
```

- `useLayoutEffect` 内：`rootRef?.current` 存在才 `mountKnowMeIcons(root)`
- 无 root：no-op（`Icon` / `TreeIcon` 仍对局部元素 mount）
- `mountKnowMeIcons(root: ParentNode)` 移除 `document` 默认值

各 surface 在根容器 div 上挂 `ref`，dep 不变。

## P0-2 workspace-init 去 notes 扫盘

```typescript
return {
  notes: [],
  groups: [],
  // sources / fileTree / state 不变
}
```

`loadAllNotes` 保留供 notesCompat；加注释禁止在冷启动路径调用。

## P1-1 流式 chunk 合并

模块级 buffer：

- `pendingStreamText: string | null`
- 收到 chunk 更新 pending（取最新 `chunk.text`）
- 首次 chunk 调度 rAF（fallback `setTimeout(32)`）
- flush 时单次 `set` + `patchLiveAssistantMessage`
- `detachStreamListener` / 会话切换前 `flushStreamChunkBuffer(set)`

## P1-2 workbenchAgentRunEvents 有界

在 `runtime-store.ts` 新增 `createEvictingEventMap(opts)`：

```javascript
{ get(key) -> events[] | undefined, set(key, events[]) }
```

内部包装 `createEvictingMap`；`boot.ts` 初始化 `{ maxEntries: 64, ttlMs: 86400000 }`。

## P1-3 环境变量

```javascript
process.env.KNOWME_PROMPT_SPACE_DIR || process.env.STICKY_PROMPT_SPACE_DIR || ''
```

`workbench-bootstrap` 已有 `KNOWME_WORKBENCH_ROOT` 优先序，保持不变。

## Risk

- surface 未挂 ref 时图标依赖 `Icon` 组件 — 可接受，与 no-op 设计一致
- 流式 throttle 最多延迟一帧 — 最终 flush 保证完整
