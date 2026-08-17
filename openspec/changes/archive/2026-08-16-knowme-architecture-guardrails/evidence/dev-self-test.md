# 开发自测 — knowme-architecture-guardrails

- `docs/architecture.md` 为人读主文档
- `.cursor/rules/architecture.mdc` alwaysApply
- `scripts/check-architecture.js` 由 `npm run lint` 调用
- 质量门禁增加架构检查与 `typecheck:renderer`
- `openspec/config.yaml` 技术栈改为 React/TS 渲染层
