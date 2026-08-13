# QA Plan — add-daemon-purpose-title

## Smoke Scope

- [ ] 打开既有 Daemon 失败/进行中任务：右栏身份区见 `Daemon 阶段 ·` 短标题
- [ ] 新启动一条任务：先出 compact 标题，有 LLM 时升级为提炼标题
- [ ] 断开/无 API Key：仍有本地标题，任务可刷新
- [ ] `node openspec/changes/add-daemon-purpose-title/evidence/daemon-mainchain-check.js`：主链路 PASS 或 API 失败干净停止并留 JSON

## Anti-patterns

- 标题区再次贴出飞书长 URL
- 标题提炼 toast 打扰 / 阻塞「开始运行」
- 顶栏与 runner 标题两套互相矛盾的长文案
