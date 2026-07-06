# QA Plan: release-v0.1.1

## Smoke Scope（必填）

- [x] 从 GitHub Release `v0.1.1` 下载 Windows installer，安装后可启动 StickyNotes（本地 `dist-release` NSIS 冒烟 PASS；GitHub 页待 tag）
- [x] 新建便签 → 输入内容 → 自动保存 → 退出应用 → 重启后内容与位置恢复
- [x] 设置页显示版本 `0.1.1`，点击「检查更新」能返回已是最新版或明确错误提示（版本 PASS；更新接线 PASS，GUI Toast ADVISORY）
- [x] 删除便签仍触发确认框；取消不删除，确认后便签消失（接线 PASS，取消 UI ADVISORY）
- [x] 设置页导出便签备份成功，目标目录包含 manifest 与 notes 数据
- [ ] Release 页面包含安装包、校验信息、Release notes、未签名/签名状态说明（待 GitHub tag；本地模板与资产已验）

## Regression Scope

- [x] `npm test` 通过
- [x] `npm run lint` 通过
- [x] 全局热键 `Ctrl+Alt+N` 新建便签（ADVISORY 代码审查）
- [x] 托盘菜单可新建、显示全部、打开设置、退出（ADVISORY 代码审查）
- [x] API Key 保存后本地 settings 不出现明文字段 `apiKey`
- [x] 知识库 OKF 导入/导出入口仍可用
- [x] 关闭便签窗口仅隐藏，不误删数据（ADVISORY 代码审查）

## Release QA

- [x] Windows installer 安装路径、开始菜单/桌面入口符合预期（静默安装 PASS）
- [x] Windows portable 或 zip 解压后可直接运行
- [x] SHA256 校验值与下载文件一致
- [x] Release notes 的版本号、日期、资产名称与实际一致
- [x] 无签名证书时，Release notes 明确提示 SmartScreen 风险；有证书时验证签名主体
- [x] 回滚说明可执行：用户能找到上一版本或暂停升级说明

## Mac Validation

- [x] 记录 Mac 设备型号、芯片、macOS 版本（阻塞记录于 mac-validation.md）
- [x] 下载/构建 Mac 资产后可打开或明确记录系统阻止原因（阻塞）
- [x] 若未签名/未公证导致无法打开，记录截图或日志，并在 Release notes 标注实验/暂不推荐
- [x] Mac 结果不得用 CI 构建成功替代实机验收

## Anti-pattern Checks

- [x] 断网时点击「检查更新」不会卡死，提示可理解（ADVISORY：逻辑层，未 GUI 断网）
- [x] 重复点击安装包或多次启动不会导致便签数据损坏
- [x] Release assets 缺失或命名错误时，不允许制作人验收通过
- [x] README 下载说明不得指向本地 `dist/` 路径或开发者机器路径
- [x] 隐私政策不得承诺尚未实现的云端能力或账号体系

## Evidence

- `openspec/changes/release-v0.1.1/evidence/dev-self-test.md`
- `openspec/changes/release-v0.1.1/evidence/test-report.md`
- `openspec/changes/release-v0.1.1/evidence/screenshots/`
