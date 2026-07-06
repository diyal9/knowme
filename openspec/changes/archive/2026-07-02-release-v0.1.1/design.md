# Design: release-v0.1.1

## Electron 边界

| 边界 | 位置 | 本 Story 要求 | 不进入本 Story |
|------|------|---------------|----------------|
| 主进程发布信息 | `src/main.js`, `src/lib/auto-update.js` | 读取 `package.json` 版本，确保手动检查更新面向 GitHub Release | 后台静默更新、差分更新策略 |
| 打包配置 | `electron-builder.yml`, `package.json` | 产出 Windows Release assets；签名参数通过环境变量注入 | 购买证书、修改系统信任链 |
| CI 发布 | `.github/workflows/release.yml` | tag 触发构建、测试、打包、上传资产 | 多渠道发布平台 |
| 用户文档 | `README.md`, `LICENSE`, 隐私政策 | 明确安装、数据路径、备份、API Key 加密与隐私边界 | 官网、营销页、应用内完整帮助中心 |
| 验收证据 | `openspec/changes/release-v0.1.1/evidence/` | 保存发布测试、Mac 实机验收与 Release 检查结果 | 自动化截图系统 |

## 发布资产

`v0.1.1` 至少应包含：

- Windows installer：面向普通用户安装。
- Windows portable/unpacked 或 zip：面向无法安装或需要快速试用的用户。
- Release notes：说明新增能力、安装方式、已知限制、回滚方式。
- 校验信息：至少提供 SHA256，便于验证下载完整性。

Mac 资产可作为条件产物：

- 若 CI 能构建且实机验收通过，可随 Release 标注为实验支持。
- 若签名、公证或实机启动失败，不作为正式推荐下载，记录阻塞原因。

## 代码签名策略

- Windows 签名通过 CI 环境变量或 GitHub Secrets 注入，不把证书、密码、私钥写入仓库。
- 无证书时允许生成未签名安装包，但 Release notes 必须明确 Windows SmartScreen 可能提示风险。
- 打包配置应能在有证书时自动签名，在无证书时不阻塞开发自测构建。

## GitHub Release 流程

1. 开发合并后更新版本到 `0.1.1`。
2. 本地或 CI 通过 `npm test`、`npm run lint`、打包检查。
3. 创建 tag `v0.1.1` 触发 Release workflow。
4. CI 上传安装包、便携包、校验文件。
5. 制作人按 `acceptance.md` 验收下载、安装、启动、检查更新。
6. 测试根据 `qa-plan.md` 执行正式 QA。

## 回滚策略

- 若 Release asset 无法安装或启动，删除或标记该 Release 为 pre-release，并在 README 暂停推荐下载。
- 若检查更新指向错误版本，优先修正 GitHub Release 元数据；需要代码修复时追加 `v0.1.2`。
- 若 Mac 实机阻塞，不影响 Windows `v0.1.1` 发布，但必须在 Release notes 标注 Mac 状态。

## 风险与约束

- 代码签名证书可能暂缺，不能把“已签名”作为无条件验收项。
- GitHub Actions 的 Electron 打包依赖网络与缓存，失败时需保留日志链接。
- Mac 实机验收依赖真实设备；无设备时该项不能勾选通过，只能记录为阻塞。
