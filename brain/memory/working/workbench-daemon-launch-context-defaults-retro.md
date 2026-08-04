# Retro: workbench-daemon-launch-context-defaults

- 日期：2026-08-03
- 归档：`openspec/changes/archive/2026-08-03-workbench-daemon-launch-context-defaults/`
- 要点：Daemon 启动弹窗优先展示远程默认上下文（项目/ref/commit/制品/PRD/输出目录），仍可手改。
- 旧 Daemon 无 defaults 接口时优雅回退本地缓存，不阻断启动；PRD 字段支持非 Markdown 需求附件路径。
- 同步 capability：`workspace`。未触碰 `workbench-*` 残桩目录。
