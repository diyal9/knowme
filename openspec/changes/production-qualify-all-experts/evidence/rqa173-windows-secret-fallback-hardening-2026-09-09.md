# RQA173 — Windows credential fallback hardening

## 目的

修正主 AI 配置与知识库 Provider 的安全存储策略不一致问题：当 Electron `safeStorage` 不可用时，Windows 新输入的凭据可以使用用户级 DPAPI 保存；任何平台或 DPAPI 不可用时仍拒绝保存明文。

## 实施

- `src/lib/settings-secure.ts` 复用 `provider-secret` 的 DPAPI 适配器。
- 读取时只识别显式 `dpapi:` 前缀，不会把普通字符串当作 DPAPI 密文。
- 保存 API Key、Embedding Key、GitLab Token、Workbench Token 均走统一安全加密函数。
- 旧的 Electron `safeStorage` 密文在系统安全存储不可用时仍显示为“已配置但无法解锁”，不会伪装成未配置。
- 未成功加密时继续返回失败和恢复指引，不写入明文。
- 修正 PowerShell 5.1 下 `ProtectedData` 程序集的显式加载路径。

## 验证

- `tests/provider-secret.test.js` + `tests/settings-secure.test.js`：13/13 通过。
- `npm run lint`：通过（仅保留既有 advisory 行数提示）。
- `npm run typecheck:renderer`：通过。
- 设置安全存储测试使用确定性 provider-secret mock 验证了 DPAPI 前缀、解密回读和明文不落盘。

## 当前边界

当前 Codex 沙箱账户未加载可用的 Windows 用户配置文件，真实 DPAPI round-trip 返回 `The data protection operation was unsuccessful`；这证明当前沙箱不能作为真实凭据验收环境，并不应被记作 Provider 成功。正式安装版仍需在真实用户账户下重跑一次保存、重启、读取和 Provider 请求验收。

该项不提升 `professionallyQualified`、`executionReady` 或 `productionReady`，因为真实 Provider、外部连接器回执和独立专业质量评审仍未完成。
