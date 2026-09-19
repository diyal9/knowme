# RQA84：普通 Agent 与专家房共用图片成果源契约

日期：2026-09-08

## 问题

专家房已经能够在 provider URL、对话正文图片地址和本地路径之间回退，但普通 Agent 的 `AgentArtifactCards` 仍优先使用 `targetPath`。当旧任务保留了失效本地路径、而工具结果实际返回了 provider URL 时，普通对话会把失效路径交给预览桥，表现为图片空白；`memory://`、`artifact://` 等标识符也可能被误当作图片地址。

## 修复

- 在 `src/domain/artifact-preview.ts` 增加平台级 `artifactPreviewSource`。
- 统一源顺序：provider URL → 对话正文中的可渲染图片地址 → 本地 `targetPath`/`path`/`meta.path`。
- 拒绝未知 URI scheme，把仅用于关联的 opaque identifier 留在元数据层。
- 专家房和普通 `AgentArtifactCards` 共用该解析器；没有新增专家 ID 特判，也没有改变本地路径仍经 preload 解析的安全边界。
- 普通 Agent 卡片同时把 `path` 纳入文件名回退，并用 provider URL 参与图片类型识别，避免只有 `url/path` 的新式成果被降级成普通文件。

## 验证

- domain artifact preview：3/3
- generic artifact preview：4/4
- expert image preview：5/5
- assistant surface：38/38
- 定向合计：50/50

追加普通成果卡路径/类型回归：assistant surface 与 renderer typecheck 通过。

完整 `npm run check` 仍需作为本轮最终门禁；本修复只证明成果物源选择与渲染入口的一致性，不替代真实 Provider 返回图片和独立视觉质量评审。
