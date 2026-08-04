# 测试报告: import-cursor-repositories-to-capability-hub

## 门禁

- [硬] npm test: PASS（892/892）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果

- Cursor 仓库入口、切换与扫描前禁用确认：PASS
- `th-art` 扫描 2 Expert / 20 Skill：PASS
- `th-BI` 扫描 1 生成 Expert / 6 Skill：PASS
- `th-config` 扫描 1 生成 Expert / 4 Skill：PASS
- 当前用户数据列出 4 Cursor Expert / 30 Cursor Skill：PASS
- 重复导入幂等、ID 冲突稳定映射：PASS
- 链接资源读取、来源丢失降级、禁用过滤：PASS
- 明文 secret 阻止且不进入公开预览：PASS

## Regression 结果

- 精选、本地、ZIP、HTTPS、自定义能力路径：PASS
- 标准 Skill、Legacy OKF、Expert Session 快照：PASS
- Connector store / allowlist 既有测试：PASS
- Electron 主进程启动：PASS
- 能力 Hub 静态页面控制台：0 error

## 反模式发现

- BLOCKING：无
- ADVISORY：`creator_mcp` 使用非 stdio 配置，当前按安全兼容策略提示并跳过；后续可评估 HTTP/SSE MCP Host。
- 误操作：未扫描时确认按钮禁用；取消不写入。
- 重复操作：再次导入更新原条目，无重复卡片。
- 状态丢失：源仓库缺失时链接技能不进入可执行列表，Hub 标记来源不可用。
- 性能：仅按用户动作扫描固定 `.cursor` 子树，应用启动不遍历仓库。

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/screenshots/`
