## 1. 契约与主进程出口

- [x] 1.1 新增 attention payload 规范化与 IPC（`attention-notify` / `attention-dismiss` / focus 查询）
- [x] 1.2 实现桌面级暗色 toast 窗（头像占位、标题、正文、关闭）；点击聚焦工作台

## 2. FAB 通知面

- [x] 2.1 FAB 订阅 `knowme-needs-attention` / cleared；渲染列表与 badge
- [x] 2.2 input 紧急度间歇动画；打开面板停止动画

## 3. Daemon HITL 竖切

- [x] 3.1 `refreshDaemonTask` HITL 边沿发射 attention；解除时 clear
- [x] 3.2 前台/后台分流调用 `attentionNotify`

## 4. 回归

- [x] 4.1 静态测试：FAB 列表/动画钩子；无 Session resume
- [x] 4.2 `npm test` / `npm run lint`；`evidence/dev-self-test.md`
