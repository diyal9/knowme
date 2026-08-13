## Context

个人工作流包可持久化 `agentPackageId`。自建专家删除后包仍留旧 id，保存时 `validateTeamPackage` → `resolveWorkbenchAgentPackage` → `loadExpert` 失败，toast 原文过技术化。删除钩子目前只解绑工作模式。

## Goals / Non-Goals

**Goals:**
- 可读的保存失败提示，指向「重新选择执行专家」
- 失效绑定在 UI 可见可改
- 删除专家时同步清空个人工作流引用，降低复发

**Non-Goals:**
- 自动迁移到新专家 id
- 放宽 fail-closed（未解析专家仍不可通过 plan / 试跑）

## Decisions

1. **提示层翻译，不改校验语义**  
   仍返回 `unresolved_*`；渲染层把 message 译成中文行动指引。  
   备选：校验层直接改文案 — 亦可，但测试与 IPC 契约更稳若保留 code。

2. **失效选项保留 selected 值**  
   下拉增加「id（已失效）」option，避免 select 落到空值却节点仍持旧 id。

3. **删除时清空引用而非删节点**  
   `clearExpertRefs` 清空 `agentRefs` 匹配项、graph members/nodes 的 package/expert 字段；节点保留，用户改绑即可。  
   备选：删节点 — 破坏连线，体验更差。

4. **`onExpertUninstalled` 聚合清理**  
   mode unbind + workflow clear；任一失败记入返回值但不回滚已删包（best-effort，与现模式一致）。

## Risks / Trade-offs

- 存量幽灵工作流不会自动清空，依赖打开编辑时的失效 UI + 友好报错；可接受。
- 清空引用后保存前仍需用户改绑；提示必须足够明确。
