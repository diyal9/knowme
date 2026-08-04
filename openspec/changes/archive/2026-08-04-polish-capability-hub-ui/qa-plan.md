# QA Plan: polish-capability-hub-ui

## Smoke Scope（必填）

- [x] 专家、技能、MCP 连接器可在同页切换且选中态正确
- [x] 搜索、分类、已安装筛选与清除筛选可用
- [x] 精选区、目录卡片与详情抽屉层级清晰
- [x] 添加能力弹窗可打开、切换来源并通过 Esc 关闭
- [x] 1024×510 与 720×600 窗口无横向溢出

## Regression Scope

- [x] 原 Catalog DTO、IPC 与安装状态机未改变
- [x] 卡片点击、键盘激活、详情和添加入口保持可用
- [x] 完整测试、定向测试与 lint 通过
- [x] 静态 Hub 页面控制台 0 error / 0 warning

## Anti-pattern Checks

- 工具栏拥挤、窄窗口横向滚动或核心操作消失
- 卡片状态、来源和版本难以扫描
- 加载、空结果、错误或弹窗破坏页面结构
- 过度阴影、持续动画或键盘焦点缺失
