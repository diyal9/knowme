# Spec: launch-readiness-p0

## prompt-space

- **WHEN** 用户以打包版启动应用  
- **THEN** 系统 SHALL NOT 自动访问 `d:\aispace\prompt_space`

## notes-backup-export

- **WHEN** 用户在设置页点击「导出便签备份」并选择目录  
- **THEN** 系统 SHALL 复制所有便签 JSON 与 MANIFEST 到目标文件夹并 Toast 成功

## notes-backup-import

- **WHEN** 用户选择有效备份文件夹  
- **THEN** 系统 SHALL 合并导入便签（同 id 跳过或覆盖策略：跳过已存在 id）

## settings-about

- **WHEN** 用户打开设置页  
- **THEN** 系统 SHALL 显示当前应用版本号

## check-update

- **WHEN** 用户点击「检查更新」（仅打包版）  
- **THEN** 系统 SHALL 调用 electron-updater 并 Toast/对话框反馈结果

## api-key-security

- **WHEN** 用户保存含 API Key 的设置  
- **THEN** settings.json SHALL NOT 包含明文 apiKey（使用 apiKeyEnc 或空）

## delete-confirm

- **WHEN** 用户触发删除便签  
- **THEN** 系统 SHALL 弹出确认对话框；取消则不删除

## close-semantics

- **WHEN** 用户点击便签窗口关闭按钮  
- **THEN** 窗口隐藏（不删除）；README 与 UI hint 说明一致
