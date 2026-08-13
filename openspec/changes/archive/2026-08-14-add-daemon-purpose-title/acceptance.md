# 制作人验收 — add-daemon-purpose-title

## 体验走查

- [ ] 打开图中同类 Daemon 失败任务：右栏步骤头可见 `Daemon 阶段 ·` 短标题（非整段 URL）
- [ ] 顶栏标题与步骤头一致或同语义；进度仍为「已完成 n/m 步」
- [ ] 有 LLM 时标题会从 compact 升级为提炼结果；无 Key 时不弹错、仍可读
- [ ] 主链路证据：`evidence/daemon-mainchain-check.json` 为 ok

## 结论

- 开发自测：PASS
- 主链路（KnowMe ↔ Daemon 读推进）：PASS（launchContext unsupported 软跳过）
- 图中 ProtoDesigner `run_task` 超时：属远端 Agent/Cursor API，非编排主链路缺陷；按约定停止，不强制重跑

待制作人勾选通过后可交测试 / `/story-done`。
