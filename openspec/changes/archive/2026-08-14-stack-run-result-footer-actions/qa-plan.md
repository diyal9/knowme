# QA Plan — stack-run-result-footer-actions

## Smoke Scope

1. 打开任意已完成的 Daemon/工作流运行结果页。
2. 确认产物白卡片上下铺满运行区；产物多时可滚动，底栏仍贴底可见。
3. 确认底栏三按钮同一行：图标+文字（返回工作流 / 再跑一次 / 查看执行过程）。
4. 点各按钮：分流与改前一致。
5. 确认输入确认态未被改成铺满竖排。

## 反模式

- 卡片仍居中矮块、底部大片空白
- 三按钮竖排或无图标
- 底栏被滚出视口

## 证据

- 契约：`tests/workbench-templates.test.js`
- 开发自测：`evidence/dev-self-test.md`
