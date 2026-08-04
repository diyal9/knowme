# QA Plan: import-cursor-repositories-to-capability-hub

## Smoke Scope（必填）

- [x] 能力 Hub → 添加能力 → Cursor 仓库入口与确认态可见
- [x] 扫描 `th-art` 显示 2 Expert、20 Skill，并提示跳过非 stdio MCP
- [x] 扫描 `th-BI` 与 `th-config` 各生成一个仓库级 Expert
- [x] 确认后专家与技能立即出现在对应 Tab，来源显示为“Cursor 仓库”
- [x] 禁用、启用与卸载链接技能状态真实生效

## Regression Scope

- [x] 精选能力安装、普通本地文件夹、ZIP、HTTPS 与自定义创建路径不回归
- [x] 标准 Skill 与 legacy OKF Skill 列表不回归
- [x] Expert 试聊继续创建冻结 Session 快照
- [x] MCP connector store 与现有飞书连接器不回归

## Anti-pattern Checks（交给测试）

- 未扫描就允许确认注册
- 导入失败后静默关闭对话框
- 重复导入生成重复卡片
- 仓库移动后仍显示可执行
- 明文 token/password/API key 进入用户数据
- 大仓库扫描阻塞应用启动
