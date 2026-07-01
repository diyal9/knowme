# QA Plan 模板

复制到 `openspec/changes/<change-name>/qa-plan.md` 并填写。

```markdown
# QA Plan: <change-name>

## Smoke Scope（必填）

- [ ] 应用启动 `npm start` 无崩溃
- [ ] <本 change 核心路径 1>
- [ ] <本 change 核心路径 2>

## Regression Scope

- [ ] 新建便签（Ctrl+Alt+N）
- [ ] 输入自动保存（500ms）
- [ ] 重启后位置/颜色/内容恢复
- [ ] 托盘菜单正常

## Anti-pattern Checks（测试专用）

- [ ] 快速连点/热键连按
- [ ] 空内容、超长文本、特殊字符
- [ ] 杀进程后数据完整性
- [ ] 多便签并发操作

## 环境

- OS: Windows 10+
- 命令: npm start
```
