# Context Engine V2 Retro

## Outcome

KnowMe 的提示词链路从“准备阶段猜能力并拼 system、工具阶段再补上下文”收敛为 Context Draft → 最终 ToolRecord → 单次 Finalization。system role 只保留平台/内置控制面；专家 persona、Soul/SOP、Skill、任务事实与用户偏好均作为受限协作上下文。

## What worked

- `sourceTrust + authority + kind` 把冲突排序与 role 权限分开，避免“可信资产自动等于 system”。
- persona 与 Skill 拆成独立 block 后可分别选择、裁剪、审计，不再用巨型字符串隐藏来源。
- 最终工具表驱动 capability contract，消除了提示词能力声明与运行时工具面漂移。
- Prompt Schema/lint、双 locale pack、tokenizer adapter、历史摘录、Outcome SLO 和行为 canary 形成可持续治理闭环。
- 22 个内置专家 prompt lint 为 0 error / 0 warning；Node 1896 项 0 fail、Renderer 417 项 0 fail，完整 `npm run check` 通过。

## Risks and follow-up

- 发布前仍需用真实 Embedding 与 Chat Provider 凭据执行 canary，并用生产流量校准 SLO。
- ContextManifest 尚无用户可见调试面板，指标也只保存在进程窗口。
