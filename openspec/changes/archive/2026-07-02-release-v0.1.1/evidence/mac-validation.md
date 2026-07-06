# Mac 实机验收记录 — release-v0.1.1

**状态：阻塞（无实机设备在本轮开发环境）**

| 字段 | 记录 |
|------|------|
| 设备型号 | _待填写_ |
| 芯片 | _Apple Silicon / Intel_ |
| macOS 版本 | _待填写_ |
| 构建资产 | `StickyNotes-0.1.1-mac-arm64.dmg` / `.zip`（CI 产物） |
| 启动结果 | _待填写：成功 / Gatekeeper 阻止 / 其他_ |
| 截图/日志 | `evidence/screenshots/mac/` |
| 验收人 | |
| 日期 | |

## 当前结论

- CI 已配置 `publish:mac`，可在 tag 推送时构建 Mac 资产。
- **未在实机验证前，Release notes 与 README 均标注 Mac 为实验/暂不推荐。**
- 阻塞项：需真实 Mac 完成打开、便签创建、重启恢复、检查更新（如有）验证。

## Gatekeeper 常见阻塞

若未签名/未公证，可能出现「无法打开，因为无法验证开发者」。记录完整对话框文案与 `spctl -a -vv` 输出。
