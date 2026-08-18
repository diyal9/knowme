## 1. 阻塞修复

- [x] 1.1 同步 `openspec/specs/agent-chat-ux` + `agent-run`：移除气泡「应用到文件」
- [x] 1.2 ContentView source 绑定 + vitest（短文/长文/过期 async）
- [x] 1.3 `main-llm-bridge` IPv4 优先 lookup，允许 IPv6-only Endpoint + 单测

## 2. 收口与证据

- [x] 2.1 更新 acceptance / test-report / dev-self-test / code-review / producer-walkthrough
- [x] 2.2 `docs/releases/v0.4.0-handoff.md` + `brain/memory/working/v0.4.0-refactor-retro.md`
- [x] 2.3 BACKLOG 诚实记录薄表面；未交付 change 不入活跃目录

## 3. 验证

- [x] 3.1 `npm run check` + `renderer:build` + `openspec:health` + harness gate
- [x] 3.2 Electron core-path smoke + `git diff --check`
