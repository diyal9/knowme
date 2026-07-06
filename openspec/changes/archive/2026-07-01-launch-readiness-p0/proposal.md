# Proposal: launch-readiness-p0

## 目标用户

已安装 StickyNotes 的 Windows/macOS 桌面用户，需要稳定、可备份、可更新的正式版体验。

## 为什么做

当前版本存在开发环境硬编码、数据无备份、API Key 明文、关闭/删除语义混淆等问题，不满足对外上线标准。

## 做什么

1. 移除生产环境 `prompt_space` 自动导入硬编码
2. 便签数据导出/导入（JSON 包 + manifest）
3. 设置页：版本号、手动检查更新
4. API Key 使用系统 safeStorage 加密存储
5. 删除便签前二次确认；明确「关闭=隐藏」
6. 主进程全局异常日志

## 非目标（Non-goals）

- 代码签名与首版 GitHub Release（需证书，单独 Story）
- 便签云同步
- Mac 实机全量验收（本 Story 以 Win 为主，Mac 配置已存在）

## 验收标准

- 打包版启动无 `okf-lib` / `prompt_space` 相关错误
- 设置页可备份/恢复便签、查看版本、检查更新
- 删除便签需确认；API Key 不以明文写入 settings.json
- `npm test` + `npm run lint` 通过

## 体验价值

降低数据丢失与误删风险，提升信任感，为 v0.2 正式 Release 铺路。
