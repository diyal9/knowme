# Retro: launch-readiness-p0

## 完成内容

- 移除生产环境 prompt_space 硬编码
- 便签备份 export/import
- 设置页：版本、检查更新、API Key 加密
- 删除确认 + 关闭/删除语义澄清

## 经验

- 运行时依赖必须放在 `src/lib/`，不能引用 `scripts/`（打包 asar 不含）
- Story 完成前 acceptance 核心路径须全部勾选，与结论一致

## 下一 Story 建议

- 代码签名 + GitHub Release v0.1.1
- LICENSE / 隐私政策
- Mac 实机验收 + 截图归档
