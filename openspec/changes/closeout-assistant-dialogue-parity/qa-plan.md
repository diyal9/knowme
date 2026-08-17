# QA Plan — closeout-assistant-dialogue-parity

## Smoke Scope

1. 助理发一条回复 → 气泡下出现「应用到文件」
2. 文件中心打开某文件预览 → 应用「追加文末」→ toast + 文件内容更新
3. 「替换全文…」→ 产物卡 draft → 接受写入 / 拒绝取消
4. 专家会话打开知识菜单 → 可见 provider + wiki/okf（或跟随默认）
5. 历史弹出项显示模式头像标记
6. 流式生成时末段有淡入动画（非 throttle 路径更明显）

## Out of scope

- 恢复便签窗 / 光标插入
- 独立 token 用量 IPC
