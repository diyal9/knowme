# QA Plan: fix-assistant-tab-bar-flash

## Smoke Scope（必填）

- [ ] 工作台打开 ≥3 个任务 Session → 点「助理」：Tab 栏无多签页闪现，稳定为助理集合
- [ ] 助理 → 工作台：Tab 栏立刻回到工作台打开集合，无助理签页闪现
- [ ] 助理内多 Tab 切换、关闭、新建仍正常

## Regression Scope

- 助理 / 工作台 Tab 隔离（任务 Session 不进助理栏）
- 历史恢复、Pin、重启后打开集合

## Anti-pattern Checks（交给测试）

- 快速连点侧栏助理/工作台：Tab 栏不得抖动成「两面混杂」
- 弱网/慢 IPC：Tab 应先对再等内容，而不是先错再对
