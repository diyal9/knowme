# Proposal: quality-pass-token-and-hygiene

## Why

横向品质排查发现工作台主按钮/审阅状态色与 `--wb-*` token 漂移，以及少量死代码残留。先做低回归小修，大项（安全 harden、拆上帝文件、Hub 色系统一）另行汇总决策。

## What Changes

- 工作台 `.wb-run-btn.primary` / `.wb-modal-btn.primary` 改用 `var(--wb-accent)`（与货架/管线服务主 CTA 对齐）
- Daemon review 进度/步骤状态色接 `--wb-success/warning/danger`
- 补全 `--wb-border` token；Studio 主工具钮硬编码绿改 token
- 删除未引用死代码 `INTENT_TEMPLATES`；移除 `MOCK_CATALOG = null` 残留并更新断言

## Out of Scope

- 不改交互流程与布局结构
- 不批量清扫 layout 千级 hex
- 不统一 Hub/壳层炭黑与工作台绿的双语义（需产品拍板）
- 不在本 change 落地安全大项（`file:` openExternal、webview、密钥 redact 等）——见 review 汇总

## Success Criteria

- 同屏工作台主按钮不再出现炭黑/绿混用
- Review 状态色与管线服务一致
- `npm test` / `npm run lint` 通过
