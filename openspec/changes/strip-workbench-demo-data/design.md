## Context

快捷专家文案已要求「添加到工作台」，但 `TaskHomeSurface` 直接过滤 `hubItems` 的全部 expert。`buildWorkflowShelf` 在未传 `verticals` 时默认 `listOfficialWorkflowPackages()`。

## Decision

1. 领域函数 `isDemoOrTestExpert` + `workbenchHomeExperts(items, modes)`：绑定 ID ∩ 非测试专家。
2. Task Home 加载 `workbenchModeList` 后再投影。
3. `buildWorkflowShelf` 默认 `verticals: []`。
4. 去掉 load 路径上的 `ensureOfficialWorkflowExperts()`。

## Risks

- 未绑定专家的用户会看到空快捷专家（符合文案，引导去专家库绑定）。
- 货架若管线离线且无个人/仓库流会变空；这是「只用正式数据」的预期。
